import { Box } from '@mui/material';
import IconifyIcon from './base/IconifyIcon';
import { resolveImage } from '../utils/ingredientImage';

// 식자재 사진 칸: 올린 사진이면 사진, 아니면 3D 일러스트를 은은한 배경 위에
const IngredientImage = ({ name, imageUrl, size = '100%', radius = 14 }: {
  name: string; imageUrl?: string | null; size?: number | string; radius?: number;
}) => {
  const img = resolveImage(name, imageUrl);
  return (
    <Box sx={{
      width: size, aspectRatio: '1 / 1', borderRadius: `${radius}px`, overflow: 'hidden', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: img.kind === 'photo' ? '#F2F4F6' : 'radial-gradient(circle at 30% 25%, #FFFFFF, #EEF3F1 70%)',
    }}>
      {img.kind === 'photo'
        ? <Box component="img" src={img.src} alt={name} sx={{ width: 1, height: 1, objectFit: 'cover' }} />
        : <IconifyIcon icon={`fluent-emoji:${img.icon}`} width="62%" height="62%" aria-label={name} />}
    </Box>
  );
};

export default IngredientImage;
