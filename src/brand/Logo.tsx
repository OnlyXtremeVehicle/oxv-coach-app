import { Image, type ImageStyle } from 'react-native';

// Insigne OXV (emblème bouclier-casque, rouge sur transparent).
// Asset officiel : assets/insignia.png (source vectorielle conservée : assets/oxv-insignia.svg).
const INSIGNIA = require('../../assets/insignia.png');

type Props = { size?: number; variant?: 'fill' | 'outline' };

export function Logo({ size = 26 }: Props) {
  return (
    <Image
      source={INSIGNIA}
      style={{ width: size, height: size, resizeMode: 'contain' } as ImageStyle}
    />
  );
}
