package gyo.plugins.app_launcher

import androidx.core.content.FileProvider

/**
 * The FileProvider of this module. A class of its own, because the manifest
 * merger tells providers apart by class: with the plain `FileProvider` here
 * too, an app that also has `@gyo-community/media`, which brings one for its
 * shares, would hold two with one name and two authorities.
 */
class ApkFileProvider : FileProvider()
