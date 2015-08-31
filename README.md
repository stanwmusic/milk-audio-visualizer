# Milkroom

Milkroom is a music visualizer. It's a hybrid of [Milkshake fork](https://github.com/gattis/milkshake/) ([ProjecM](http://projectm.sourceforge.net/) rewritten in Javascript) and [Soundcloud Visualizer](https://github.com/gunderson/soundcloud-visualizer).

# Demo

[A working demo](http://nikicat.github.io/milkroom). Enjoy and share!

# Instructions

Go to [https://soundcloud.com] (https://soundcloud.com) and find some music. From the individual song page, copy the url and paste it into the input of the visualizer, then hit enter or press the play button.

You'll notice that part of the the track URL is added to the visualizer's URL. This makes it possible to easily save or share the state. So, if you find a good track that looks cool with
 the visualization that you want to share, just give the new URL to someone and when they load it up, it'll automatically start streaming and visualizing that track.

## Playlists
Playlists (also known as "sets" in Soundcloud) can now be pasted into the visualizer, which will cause the whole playlist to play in sequence. You can navigate the playlist using the controls below.

## Controls
- `spacebar` = toggle play/pause
- `>` (right arrow key) = skip forward to next track in playlist
- `<` (left arrow key) = skip backward to previous track in playlist

# Browser compatibility

- *Chrome* Works well.
- *Firefox* Works well.
- *Safari* Not tested.
- *IE* Nope.
- *Opera* Not tested.

# Improvements

I can think of a few improvements that I might implement, or someone else might want to:

~~- Support for playlists. So you can paste the playlist URL and it just keeps going through to the end of the playlist.~~ - DONE (thanks to [adg29](https://github.com/adg29))
- More types of visualization. I've written the code in a pretty modular way so it's simple to write a visualization that can plug into the app (see below)
- Better browser support. I'm sure there can be more done on this to get it working at least in Firefox and mobile WebKit browsers, with perhaps fallbacks for IE.

# License

MIT

