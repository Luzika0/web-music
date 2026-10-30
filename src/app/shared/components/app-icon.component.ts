import { Component, Input } from '@angular/core';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideArrowUpRight,
  LucideAudioLines,
  LucideCalendarDays,
  LucideCheck,
  LucideChevronLeft,
  LucideChevronRight,
  LucideCircleAlert,
  LucideCircleHelp,
  LucideCompass,
  LucideDisc3,
  LucideEye,
  LucideEyeOff,
  LucideHeart,
  LucideHouse,
  LucideImage,
  LucideInfo,
  LucideLibrary,
  LucideListMusic,
  LucideLoaderCircle,
  LucideLogIn,
  LucideLogOut,
  LucideMail,
  LucideMoon,
  LucideMusic2,
  LucidePause,
  LucidePlay,
  LucidePlus,
  LucideRepeat,
  LucideSearch,
  LucideSearchX,
  LucideShuffle,
  LucideSkipBack,
  LucideSkipForward,
  LucideSun,
  LucideUpload,
  LucideUserRound,
  LucideUsersRound,
  LucideVolume,
  LucideVolume1,
  LucideVolume2,
  LucideVolumeX,
  LucideX,
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
  LucideShieldCheck,
  LucideFileAudio,
  LucideRefreshCw,
  LucideTrash2,
  LucideEllipsis,
  LucideCircleCheck,
  LucideSettings2,
} from '@lucide/angular';
import { LucideIcon } from '@lucide/angular';

const ICONS = {
  home: LucideHouse,
  search: LucideSearch,
  discover: LucideCompass,
  artists: LucideUsersRound,
  heart: LucideHeart,
  library: LucideLibrary,
  sun: LucideSun,
  moon: LucideMoon,
  logout: LucideLogOut,
  login: LucideLogIn,
  plus: LucidePlus,
  external: LucideArrowUpRight,
  next: LucideArrowRight,
  previous: LucideArrowLeft,
  eye: LucideEye,
  eyeOff: LucideEyeOff,
  music: LucideMusic2,
  play: LucidePlay,
  pause: LucidePause,
  shuffle: LucideShuffle,
  skipBack: LucideSkipBack,
  skipForward: LucideSkipForward,
  repeat: LucideRepeat,
  volume: LucideVolume,
  volumeLow: LucideVolume1,
  volumeMedium: LucideVolume2,
  volumeHigh: LucideVolume2,
  mute: LucideVolumeX,
  queue: LucideListMusic,
  close: LucideX,
  check: LucideCheck,
  upload: LucideUpload,
  image: LucideImage,
  help: LucideCircleHelp,
  chevronLeft: LucideChevronLeft,
  chevronRight: LucideChevronRight,
  disc: LucideDisc3,
  equalizer: LucideAudioLines,
  alert: LucideCircleAlert,
  info: LucideInfo,
  loading: LucideLoaderCircle,
  user: LucideUserRound,
  mail: LucideMail,
  calendar: LucideCalendarDays,
  panelClose: LucidePanelLeftClose,
  panelOpen: LucidePanelLeftOpen,
  security: LucideShieldCheck,
  audioFile: LucideFileAudio,
  refresh: LucideRefreshCw,
  delete: LucideTrash2,
  more: LucideEllipsis,
  success: LucideCircleCheck,
  settings: LucideSettings2,
  searchEmpty: LucideSearchX,
} as const;

export type AppIconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [LucideIcon],
  template: `
    <svg
      [lucideIcon]="iconData"
      [size]="size"
      [strokeWidth]="strokeWidth"
      [attr.aria-hidden]="decorative ? 'true' : null"
      [attr.role]="decorative ? null : 'img'"
      [attr.aria-label]="decorative ? null : label"
      [style.width]="cssSize"
      [style.height]="cssSize"
      focusable="false"
    ></svg>
  `,
  styles: [`
     :host { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; line-height: 0; vertical-align: middle; color: inherit; pointer-events: none; }
    svg { display: block; max-width: 100%; max-height: 100%; overflow: visible; }
    :host(.icon-spin) svg { animation: app-icon-spin 1s linear infinite; }
    @keyframes app-icon-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { :host(.icon-spin) svg { animation: none; } }
  `],
})
export class AppIconComponent {
  @Input() name: AppIconName = 'music';
  @Input() size: number | string = 20;
  @Input() strokeWidth = 1.8;
  @Input() decorative = true;
  @Input() label = '';

  get iconData() {
    return ICONS[this.name] ?? LucideMusic2;
  }

  get cssSize(): string {
    return typeof this.size === 'number' ? `${this.size}px` : this.size;
  }
}
