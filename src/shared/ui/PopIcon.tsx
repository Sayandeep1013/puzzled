import {
  ArrowLeft,
  ArrowsClockwise,
  CalendarBlank,
  CaretRight,
  ChartBar,
  CheckCircle,
  Coins,
  Compass,
  Eye,
  Fire,
  Gear,
  Heart,
  House,
  Image as ImageIcon,
  Lightbulb,
  Medal,
  MusicNotes,
  Palette,
  PawPrint,
  Play,
  Plus,
  PuzzlePiece,
  Question,
  ShoppingBag,
  SignOut,
  SpeakerHigh,
  Sparkle,
  Star,
  Storefront,
  Trophy,
  User,
  X,
  type IconProps,
} from 'phosphor-react-native';
import { type ComponentType } from 'react';

import { colors } from '@/shared/theme';

/**
 * Curated map. Adding an icon is a one-line change here; screens can only use
 * names in this map, so a typo is a type error rather than a blank square.
 */
const ICONS = {
  back: ArrowLeft,
  calendar: CalendarBlank,
  chart: ChartBar,
  check: CheckCircle,
  chevron: CaretRight,
  close: X,
  coin: Coins,
  edges: PuzzlePiece,
  exit: SignOut,
  explore: Compass,
  eye: Eye,
  gear: Gear,
  heart: Heart,
  help: Question,
  hint: Lightbulb,
  home: House,
  library: ImageIcon,
  medal: Medal,
  music: MusicNotes,
  packs: ShoppingBag,
  palette: Palette,
  paw: PawPrint,
  play: Play,
  plus: Plus,
  profile: User,
  puzzle: PuzzlePiece,
  restart: ArrowsClockwise,
  shop: Storefront,
  sound: SpeakerHigh,
  sparkle: Sparkle,
  star: Star,
  streak: Fire,
  trophy: Trophy,
} satisfies Record<string, ComponentType<IconProps>>;

export type PopIconName = keyof typeof ICONS;

interface PopIconProps {
  name: PopIconName;
  size?: number;
  color?: string;
  /** `fill` is the default — outline weights read as thin next to 3px borders. */
  weight?: IconProps['weight'];
  testID?: string;
}

export function PopIcon({
  name,
  size = 24,
  color = colors.ink,
  weight = 'fill',
  testID,
}: PopIconProps) {
  const Glyph = ICONS[name];
  return <Glyph size={size} color={color} weight={weight} testID={testID} />;
}
