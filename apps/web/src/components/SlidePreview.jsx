import SlideshowOutlinedIcon from '@mui/icons-material/SlideshowOutlined';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { getSlidePreviewImage } from '../utils/slideUtils';

function SlidePreview({
  slide,
  size = 'small',
  borderRadius = 1,
  emptyLabel = 'No preview',
  onImageError,
  sx,
}) {
  const slideImage = getSlidePreviewImage(slide);
  const isLarge = size === 'large';

  return (
    <Box
      sx={{
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius,
        border: '1px solid var(--border, #e5e4e7)',
        backgroundColor: 'var(--surface, #f7f4fb)',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        ...sx,
      }}
    >
      {slideImage ? (
        <Box
          component="img"
          src={slideImage}
          alt={`Slide ${slide.slideNumber}`}
          onError={onImageError}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
            display: 'block',
          }}
        />
      ) : (
        <Stack spacing={1} alignItems="center" sx={{ p: isLarge ? 3 : 1 }}>
          {isLarge && <SlideshowOutlinedIcon />}
          <Typography
            variant={isLarge ? 'body2' : 'caption'}
            sx={{ color: 'var(--text-muted)' }}
          >
            {emptyLabel}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

export default SlidePreview;
