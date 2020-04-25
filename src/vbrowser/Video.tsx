/*
<template>
  <div ref="component" class="video">
    <div ref="player" class="player">
      <div ref="container" class="player-container">
        <video ref="video" />
        <div class="emotes">
          <template v-for="(emote, index) in emotes">
            <neko-emote :id="index" :key="index" />
          </template>
        </div>
        <div
          ref="overlay"
          class="overlay"
          tabindex="0"
          @click.stop.prevent
          @contextmenu.stop.prevent
          @wheel.stop.prevent="onWheel"
          @mousemove.stop.prevent="onMouseMove"
          @mousedown.stop.prevent="onMouseDown"
          @mouseup.stop.prevent="onMouseUp"
          @mouseenter.stop.prevent="onMouseEnter"
          @mouseleave.stop.prevent="onMouseLeave"
          @keydown.stop.prevent="onKeyDown"
          @keyup.stop.prevent="onKeyUp"
        />
        <div v-if="!playing" class="player-overlay">
          <i @click.stop.prevent="toggle" v-if="playable" class="fas fa-play-circle" />
        </div>
        <div ref="aspect" class="player-aspect" />
      </div>
      <ul v-if="!fullscreen" class="video-menu">
        <li><i @click.stop.prevent="requestFullscreen" class="fas fa-expand"></i></li>
        <li v-if="admin"><i @click.stop.prevent="onResolution" class="fas fa-desktop"></i></li>
      </ul>
      <neko-resolution ref="resolution" />
    </div>
  </div>
</template>
*/

import { Component, Ref, Watch, Vue } from 'vue-property-decorator';
import ResizeObserver from 'resize-observer-polyfill';

import Emote from './emote.vue';
import Resolution from './resolution.vue';

@Component({
  name: 'neko-video',
  components: {
    'neko-emote': Emote,
    'neko-resolution': Resolution,
  },
})
export default class extends Vue {
  @Ref('component') readonly _component!: HTMLElement;
  @Ref('container') readonly _container!: HTMLElement;
  @Ref('overlay') readonly _overlay!: HTMLElement;
  @Ref('aspect') readonly _aspect!: HTMLElement;
  @Ref('player') readonly _player!: HTMLElement;
  @Ref('video') readonly _video!: HTMLVideoElement;
  @Ref('resolution') readonly _resolution!: any;

  private observer = new ResizeObserver(this.onResise.bind(this));
  private focused = false;
  private fullscreen = false;
  private activeKeys: Set<number> = new Set();

  get admin() {
    return this.$accessor.user.admin;
  }

  get connected() {
    return this.$accessor.connected;
  }

  get connecting() {
    return this.$accessor.connecting;
  }

  get hosting() {
    return this.$accessor.remote.hosting;
  }

  get volume() {
    return this.$accessor.video.volume;
  }

  get muted() {
    return this.$accessor.video.muted;
  }

  get stream() {
    return this.$accessor.video.stream;
  }

  get playing() {
    return this.$accessor.video.playing;
  }

  get playable() {
    return this.$accessor.video.playable;
  }

  get emotes() {
    return this.$accessor.chat.emotes;
  }

  get autoplay() {
    return this.$accessor.settings.autoplay;
  }

  get locked() {
    return this.$accessor.remote.locked;
  }

  get scroll() {
    return this.$accessor.settings.scroll;
  }

  get scroll_invert() {
    return this.$accessor.settings.scroll_invert;
  }

  get clipboard() {
    return this.$accessor.remote.clipboard;
  }

  get width() {
    return this.$accessor.video.width;
  }

  get height() {
    return this.$accessor.video.height;
  }

  get rate() {
    return this.$accessor.video.rate;
  }

  get vertical() {
    return this.$accessor.video.vertical;
  }

  get horizontal() {
    return this.$accessor.video.horizontal;
  }

  @Watch('width')
  onWidthChanged(width: number) {
    this.onResise();
  }

  @Watch('height')
  onHeightChanged(height: number) {
    this.onResise();
  }

  @Watch('volume')
  onVolumeChanged(volume: number) {
    if (this._video) {
      this._video.volume = this.volume / 100;
    }
  }

  @Watch('muted')
  onMutedChanged(muted: boolean) {
    if (this._video) {
      this._video.muted = muted;
    }
  }

  @Watch('stream')
  onStreamChanged(stream?: MediaStream) {
    if (!this._video || !stream) {
      return;
    }

    if ('srcObject' in this._video) {
      this._video.srcObject = stream;
    } else {
      // @ts-ignore
      this._video.src = window.URL.createObjectURL(this.stream); // for older browsers
    }
  }

  @Watch('playing')
  onPlayingChanged(playing: boolean) {
    if (playing) {
      this.play();
    } else {
      this.pause();
    }
  }

  @Watch('clipboard')
  onClipboardChanged(clipboard: string) {
    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      navigator.clipboard.writeText(clipboard).catch(console.error);
    }
  }

  mounted() {
    this._container.addEventListener('resize', this.onResise);
    this.onVolumeChanged(this.volume);
    this.onStreamChanged(this.stream);
    this.onResise();

    this.observer.observe(this._component);

    this._player.addEventListener('fullscreenchange', () => {
      this.fullscreen = document.fullscreenElement !== null;
      this.onResise();
    });

    this._video.addEventListener('canplaythrough', () => {
      this.$accessor.video.setPlayable(true);
      if (this.autoplay) {
        if (!document.hasFocus() || !this.$accessor.active) {
          this.$accessor.video.setMuted(true);
          this._video.muted = true;
        }

        this.$nextTick(() => {
          this.$accessor.video.play();
        });
      }
    });

    this._video.addEventListener('ended', () => {
      this.$accessor.video.setPlayable(false);
    });

    this._video.addEventListener('error', (event) => {
      this.$log.error(event.error);
      this.$accessor.video.setPlayable(false);
    });

    document.addEventListener('focusin', this.onFocus.bind(this));
    document.addEventListener('focusout', this.onBlur.bind(this));
  }

  beforeDestroy() {
    this.observer.disconnect();
    this.$accessor.video.setPlayable(false);
    document.removeEventListener('focusin', this.onFocus.bind(this));
    document.removeEventListener('focusout', this.onBlur.bind(this));
  }

  play() {
    if (!this._video.paused || !this.playable) {
      return;
    }

    try {
      this._video
        .play()
        .then(() => {
          this.onResise();
        })
        .catch((err) => this.$log.error);
    } catch (err) {
      this.$log.error(err);
    }
  }

  pause() {
    if (this._video.paused || !this.playable) {
      return;
    }

    this._video.pause();
  }

  toggle() {
    if (!this.playable) {
      return;
    }

    if (!this.playing) {
      this.$accessor.video.play();
    } else {
      this.$accessor.video.pause();
    }
  }

  requestFullscreen() {
    this._player.requestFullscreen();
    this.onResise();
  }

  onFocus() {
    if (!document.hasFocus() || !this.$accessor.active) {
      return;
    }

    if (
      this.hosting &&
      navigator.clipboard &&
      typeof navigator.clipboard.readText === 'function'
    ) {
      navigator.clipboard
        .readText()
        .then((text) => {
          if (this.clipboard !== text) {
            this.$accessor.remote.setClipboard(text);
            this.$accessor.remote.sendClipboard(text);
          }
        })
        .catch(this.$log.error);
    }
  }

  onBlur() {
    if (!this.focused || !this.hosting || this.locked) {
      return;
    }

    for (let key of this.activeKeys) {
      this.$client.sendData('keyup', { key });
      this.activeKeys.delete(key);
    }
  }

  onMousePos(e: MouseEvent) {
    const { w, h } = this.$accessor.video.resolution;
    const rect = this._overlay.getBoundingClientRect();
    this.$client.sendData('mousemove', {
      x: Math.round((w / rect.width) * (e.clientX - rect.left)),
      y: Math.round((h / rect.height) * (e.clientY - rect.top)),
    });
  }

  onWheel(e: WheelEvent) {
    if (!this.hosting || this.locked) {
      return;
    }
    this.onMousePos(e);

    let x = e.deltaX;
    let y = e.deltaY;

    if (this.scroll_invert) {
      x = x * -1;
      y = y * -1;
    }

    x = Math.min(Math.max(x, -this.scroll), this.scroll);
    y = Math.min(Math.max(y, -this.scroll), this.scroll);

    this.$client.sendData('wheel', { x, y });
  }

  onMouseDown(e: MouseEvent) {
    if (!this.hosting || this.locked) {
      return;
    }
    this.onMousePos(e);
    this.$client.sendData('mousedown', { key: e.button });
  }

  onMouseUp(e: MouseEvent) {
    if (!this.hosting || this.locked) {
      return;
    }
    this.onMousePos(e);
    this.$client.sendData('mouseup', { key: e.button });
  }

  onMouseMove(e: MouseEvent) {
    if (!this.hosting || this.locked) {
      return;
    }
    this.onMousePos(e);
  }

  onMouseEnter(e: MouseEvent) {
    this._overlay.focus();
    this.onFocus();
    this.focused = true;
  }

  onMouseLeave(e: MouseEvent) {
    this.focused = false;
  }

  // frick you firefox
  getCode(e: KeyboardEvent): number {
    let key = e.keyCode;
    if (key === 59 && (e.key === ';' || e.key === ':')) {
      key = 186;
    }

    if (key === 61 && (e.key === '=' || e.key === '+')) {
      key = 187;
    }

    if (key === 173 && (e.key === '-' || e.key === '_')) {
      key = 189;
    }

    return key;
  }

  onKeyDown(e: KeyboardEvent) {
    if (!this.focused || !this.hosting || this.locked) {
      return;
    }

    let key = this.getCode(e);
    this.$client.sendData('keydown', { key });
    this.activeKeys.add(key);
  }

  onKeyUp(e: KeyboardEvent) {
    if (!this.focused || !this.hosting || this.locked) {
      return;
    }

    let key = this.getCode(e);
    this.$client.sendData('keyup', { key });
    this.activeKeys.delete(key);
  }

  onResise() {
    let height = 0;
    if (!this.fullscreen) {
      const { offsetWidth, offsetHeight } = this._component;
      this._player.style.width = `${offsetWidth}px`;
      this._player.style.height = `${offsetHeight}px`;
      height = offsetHeight;
    } else {
      const { offsetWidth, offsetHeight } = this._player;
      height = offsetHeight;
    }

    this._container.style.maxWidth = `${
      (this.horizontal / this.vertical) * height
    }px`;
    this._aspect.style.paddingBottom = `${
      (this.vertical / this.horizontal) * 100
    }%`;
  }

  onResolution(event: MouseEvent) {
    this._resolution.open(event);
  }
}