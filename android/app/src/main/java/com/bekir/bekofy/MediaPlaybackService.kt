package com.bekir.bekofy

import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MediaPlaybackService : Service() {

    companion object {
        const val CHANNEL_ID = "bekofy_playback_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_PLAY = "com.bekir.bekofy.ACTION_PLAY"
        const val ACTION_PAUSE = "com.bekir.bekofy.ACTION_PAUSE"
        const val ACTION_NEXT = "com.bekir.bekofy.ACTION_NEXT"
        const val ACTION_PREVIOUS = "com.bekir.bekofy.ACTION_PREVIOUS"
        const val ACTION_STOP = "com.bekir.bekofy.ACTION_STOP"
    }

    private val binder = LocalBinder()
    private var mediaSession: MediaSessionCompat? = null
    var onMediaActionListener: ((action: String) -> Unit)? = null

    private var currentTitle: String = "Bekofy Music"
    private var currentArtist: String = "Bekofy"
    private var isPlaying: Boolean = false
    private var currentBitmap: Bitmap? = null

    inner class LocalBinder : Binder() {
        fun getService(): MediaPlaybackService = this@MediaPlaybackService
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        initMediaSession()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Bekofy Media Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Bekofy playback controls notification"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun initMediaSession() {
        mediaSession = MediaSessionCompat(this, "BekofyMediaSession").apply {
            setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                        MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
            )

            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() {
                    onMediaActionListener?.invoke("play")
                }

                override fun onPause() {
                    onMediaActionListener?.invoke("pause")
                }

                override fun onSkipToNext() {
                    onMediaActionListener?.invoke("next")
                }

                override fun onSkipToPrevious() {
                    onMediaActionListener?.invoke("prev")
                }

                override fun onStop() {
                    onMediaActionListener?.invoke("stop")
                    stopForeground(STOP_FOREGROUND_REMOVE)
                }
            })

            isActive = true
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        intent?.action?.let { action ->
            when (action) {
                ACTION_PLAY -> onMediaActionListener?.invoke("play")
                ACTION_PAUSE -> onMediaActionListener?.invoke("pause")
                ACTION_NEXT -> onMediaActionListener?.invoke("next")
                ACTION_PREVIOUS -> onMediaActionListener?.invoke("prev")
                ACTION_STOP -> {
                    onMediaActionListener?.invoke("stop")
                    stopSelf()
                }
                else -> {}
            }
        }
        return START_NOT_STICKY
    }

    fun updateMediaState(title: String, artist: String, coverUrl: String, playing: Boolean) {
        currentTitle = title
        currentArtist = artist
        isPlaying = playing

        val state = if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
        val actions = PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_PLAY_PAUSE

        mediaSession?.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1.0f)
                .setActions(actions)
                .build()
        )

        mediaSession?.setMetadata(
            MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .build()
        )

        showNotification()

        if (coverUrl.isNotEmpty() && coverUrl.startsWith("http")) {
            thread {
                try {
                    val url = URL(coverUrl)
                    val connection = url.openConnection() as HttpURLConnection
                    connection.doInput = true
                    connection.connect()
                    val input: InputStream = connection.inputStream
                    currentBitmap = BitmapFactory.decodeStream(input)

                    mediaSession?.setMetadata(
                        MediaMetadataCompat.Builder()
                            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                            .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentBitmap)
                            .build()
                    )
                    showNotification()
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    private fun showNotification() {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingOpenIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val prevIntent = Intent(this, MediaPlaybackService::class.java).apply { action = ACTION_PREVIOUS }
        val pendingPrev = PendingIntent.getService(this, 1, prevIntent, PendingIntent.FLAG_IMMUTABLE)

        val playPauseIntent = Intent(this, MediaPlaybackService::class.java).apply {
            action = if (isPlaying) ACTION_PAUSE else ACTION_PLAY
        }
        val pendingPlayPause = PendingIntent.getService(this, 2, playPauseIntent, PendingIntent.FLAG_IMMUTABLE)

        val nextIntent = Intent(this, MediaPlaybackService::class.java).apply { action = ACTION_NEXT }
        val pendingNext = PendingIntent.getService(this, 3, nextIntent, PendingIntent.FLAG_IMMUTABLE)

        val playPauseIcon = if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setLargeIcon(currentBitmap)
            .setContentIntent(pendingOpenIntent)
            .setOngoing(isPlaying)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_media_previous, "Previous", pendingPrev)
            .addAction(playPauseIcon, if (isPlaying) "Pause" else "Play", pendingPlayPause)
            .addAction(android.R.drawable.ic_media_next, "Next", pendingNext)
            .setStyle(
                androidx.media.app.NotificationCompat.MediaStyle()
                    .setShowActionsInCompactView(0, 1, 2)
                    .setMediaSession(mediaSession?.sessionToken)
            )

        startForeground(NOTIFICATION_ID, builder.build())
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onDestroy() {
        mediaSession?.release()
        super.onDestroy()
    }
}
