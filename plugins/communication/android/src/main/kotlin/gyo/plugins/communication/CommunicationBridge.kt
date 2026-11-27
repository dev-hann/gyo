package gyo.plugins.communication

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.CallLog
import android.provider.ContactsContract
import android.telephony.SmsManager
import android.util.Log
import androidx.core.content.ContextCompat
import gyo.plugins.bridge.BridgeHandler
import org.json.JSONArray
import org.json.JSONObject

/**
 * Answers the `communication` bridge for every class of the package:
 *
 * - `ContactSearch`: `search`
 * - `SmsSender`: `send`, `read`
 * - `PhoneCaller`: `call`, `get_call_log`
 *
 * Every method answers with a result, even when a permission is missing: an
 * empty result, or `false`. Nothing is thrown to the web side.
 */
class CommunicationBridge(private val context: Context) : BridgeHandler {

    companion object {
        private const val TAG = "Gyo-Communication"
        private const val SMS_INBOX_URI = "content://sms/inbox"
    }

    override fun handle(method: String, data: JSONObject): Any? {
        return when (method) {
            "search" -> search(data)
            "send" -> send(data)
            "read" -> read(data)
            "call" -> call(data)
            "get_call_log" -> getCallLog(data)
            else -> {
                Log.w(TAG, "Unknown method: $method")
                null
            }
        }
    }

    // ContactSearch

    private fun search(data: JSONObject): JSONObject {
        val query = data.optString("query", "").trim()
        if (query.isEmpty()) {
            Log.w(TAG, "search: query is empty")
            return JSONObject().apply {
                put("contacts", JSONArray())
                put("count", 0)
            }
        }

        val contacts = JSONArray()
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Email.CONTACT_ID,
            ContactsContract.Contacts.DISPLAY_NAME,
        )

        val selection = "${ContactsContract.Contacts.DISPLAY_NAME} LIKE ?"
        val selectionArgs = arrayOf("%$query%")

        val contactMap = mutableMapOf<Long, String>()

        try {
            context.contentResolver.query(
                ContactsContract.Contacts.CONTENT_URI,
                arrayOf(
                    ContactsContract.Contacts._ID,
                    ContactsContract.Contacts.DISPLAY_NAME,
                ),
                selection,
                selectionArgs,
                ContactsContract.Contacts.DISPLAY_NAME + " ASC",
            )?.use { cursor ->
                val idIndex = cursor.getColumnIndexOrThrow(ContactsContract.Contacts._ID)
                val nameIndex = cursor.getColumnIndexOrThrow(ContactsContract.Contacts.DISPLAY_NAME)

                while (cursor.moveToNext()) {
                    val contactId = cursor.getLong(idIndex)
                    val name = cursor.getString(nameIndex) ?: continue
                    contactMap[contactId] = name
                }
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "search: READ_CONTACTS permission not granted", e)
            return JSONObject().apply {
                put("contacts", JSONArray())
                put("count", 0)
            }
        } catch (e: Exception) {
            Log.e(TAG, "search: failed to query contacts", e)
            return JSONObject().apply {
                put("contacts", JSONArray())
                put("count", 0)
            }
        }

        for ((contactId, name) in contactMap) {
            val phoneNumbers = getPhoneNumbers(contactId)
            val emails = getEmails(contactId)

            val contactInfo = JSONObject().apply {
                put("id", contactId.toString())
                put("name", name)
                put("phoneNumbers", phoneNumbers)
                put("emails", emails)
            }
            contacts.put(contactInfo)
        }

        return JSONObject().apply {
            put("contacts", contacts)
            put("count", contacts.length())
        }
    }

    private fun getPhoneNumbers(contactId: Long): JSONArray {
        val numbers = JSONArray()

        try {
            context.contentResolver.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
                "${ContactsContract.CommonDataKinds.Phone.CONTACT_ID} = ?",
                arrayOf(contactId.toString()),
                null,
            )?.use { cursor ->
                val numberIndex = cursor.getColumnIndexOrThrow(
                    ContactsContract.CommonDataKinds.Phone.NUMBER
                )
                while (cursor.moveToNext()) {
                    val number = cursor.getString(numberIndex) ?: continue
                    numbers.put(number)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "getPhoneNumbers: failed for contact $contactId", e)
        }

        return numbers
    }

    private fun getEmails(contactId: Long): JSONArray {
        val emails = JSONArray()

        try {
            context.contentResolver.query(
                ContactsContract.CommonDataKinds.Email.CONTENT_URI,
                arrayOf(ContactsContract.CommonDataKinds.Email.DATA),
                "${ContactsContract.CommonDataKinds.Email.CONTACT_ID} = ?",
                arrayOf(contactId.toString()),
                null,
            )?.use { cursor ->
                val emailIndex = cursor.getColumnIndexOrThrow(
                    ContactsContract.CommonDataKinds.Email.DATA
                )
                while (cursor.moveToNext()) {
                    val email = cursor.getString(emailIndex) ?: continue
                    emails.put(email)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "getEmails: failed for contact $contactId", e)
        }

        return emails
    }

    // SmsSender

    private fun send(data: JSONObject): Boolean {
        val phoneNumber = data.optString("phoneNumber", "")
        val message = data.optString("message", "")

        if (phoneNumber.isEmpty() || message.isEmpty()) {
            Log.w(TAG, "send: phoneNumber or message is empty")
            return false
        }

        if (!hasSendPermission()) {
            Log.e(TAG, "send: SEND_SMS permission not granted")
            return false
        }

        return try {
            val smsManager = getSmsManager()
            smsManager.sendTextMessage(phoneNumber, null, message, null, null)
            Log.d(TAG, "SMS sent to $phoneNumber")
            true
        } catch (e: Exception) {
            Log.e(TAG, "send: failed to send SMS to $phoneNumber", e)
            false
        }
    }

    @Suppress("TooGenericExceptionCaught")
    private fun read(data: JSONObject): JSONObject {
        val limit = data.optInt("limit", 10).coerceIn(1, 100)

        if (!hasReadPermission()) {
            Log.e(TAG, "read: READ_SMS permission not granted")
            return JSONObject().apply {
                put("messages", JSONArray())
                put("count", 0)
            }
        }

        val messages = JSONArray()

        try {
            val uri = android.net.Uri.parse(SMS_INBOX_URI)
            val cursor: Cursor? = context.contentResolver.query(
                uri,
                arrayOf("_id", "address", "body", "date", "type"),
                null,
                null,
                "date DESC"
            )

            cursor?.use {
                var count = 0
                while (it.moveToNext() && count < limit) {
                    val smsMessage = JSONObject().apply {
                        put("id", it.getString(it.getColumnIndexOrThrow("_id")))
                        put("address", it.getString(it.getColumnIndexOrThrow("address")))
                        put("body", it.getString(it.getColumnIndexOrThrow("body")))
                        put("date", it.getLong(it.getColumnIndexOrThrow("date")))
                        put("type", mapSmsType(it.getInt(it.getColumnIndexOrThrow("type"))))
                    }
                    messages.put(smsMessage)
                    count++
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "read: failed to read SMS", e)
        }

        return JSONObject().apply {
            put("messages", messages)
            put("count", messages.length())
        }
    }

    private fun mapSmsType(type: Int): String {
        return when (type) {
            1 -> "inbox"
            2 -> "sent"
            3 -> "draft"
            4 -> "outbox"
            5 -> "failed"
            6 -> "queued"
            else -> "unknown"
        }
    }

    private fun hasSendPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.SEND_SMS
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasReadPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED
    }

    @Suppress("DEPRECATION")
    private fun getSmsManager(): SmsManager {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            context.getSystemService(SmsManager::class.java)
        } else {
            SmsManager.getDefault()
        }
    }

    // PhoneCaller

    private fun call(data: JSONObject): Boolean {
        val phoneNumber = data.optString("phoneNumber", "")
        if (phoneNumber.isEmpty()) {
            Log.w(TAG, "call: phoneNumber is empty")
            return false
        }

        val intent = Intent(Intent.ACTION_CALL, Uri.parse("tel:$phoneNumber")).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        return try {
            context.startActivity(intent)
            Log.d(TAG, "Calling: $phoneNumber")
            true
        } catch (e: SecurityException) {
            Log.e(TAG, "call: no CALL_PHONE permission for $phoneNumber", e)
            false
        } catch (e: Exception) {
            Log.e(TAG, "call: failed to call $phoneNumber", e)
            false
        }
    }

    private fun getCallLog(data: JSONObject): JSONObject {
        val limit = data.optInt("limit", 20)
        val entries = JSONArray()

        try {
            val cursor = context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.CACHED_NAME,
                    CallLog.Calls.DATE,
                    CallLog.Calls.DURATION,
                    CallLog.Calls.TYPE
                ),
                null,
                null,
                "${CallLog.Calls.DATE} DESC"
            )

            cursor?.use {
                var count = 0
                while (it.moveToNext() && count < limit) {
                    val number = it.getString(0) ?: ""
                    val name = it.getString(1) ?: ""
                    val date = it.getLong(2)
                    val duration = it.getLong(3)
                    val typeInt = it.getInt(4)
                    val type = when (typeInt) {
                        CallLog.Calls.INCOMING_TYPE -> "INCOMING"
                        CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
                        CallLog.Calls.MISSED_TYPE -> "MISSED"
                        CallLog.Calls.REJECTED_TYPE -> "REJECTED"
                        CallLog.Calls.BLOCKED_TYPE -> "BLOCKED"
                        else -> "UNKNOWN"
                    }

                    val entry = JSONObject().apply {
                        put("number", number)
                        put("name", name)
                        put("date", date)
                        put("duration", duration)
                        put("type", type)
                    }
                    entries.put(entry)
                    count++
                }
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "get_call_log: no READ_CALL_LOG permission", e)
        } catch (e: Exception) {
            Log.e(TAG, "get_call_log: failed to query call log", e)
        }

        return JSONObject().apply {
            put("entries", entries)
            put("count", entries.length())
        }
    }
}
