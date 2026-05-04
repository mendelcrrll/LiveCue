import SlideshowOutlinedIcon from '@mui/icons-material/SlideshowOutlined';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { getSlideDisplayImage } from '../utils/slideUtils';

function FullPageSlide({ slide, slideCount }) {
  const slideImage = getSlideDisplayImage(slide);

  return (
    <Box
      component="main"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        overflow: 'hidden',
        backgroundColor: '#050505',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {slideImage ? (
        <Box
          component="img"
          src={slideImage}
          alt={`Slide ${slide.slideNumber}`}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
            display: 'block',
          }}
        />
      ) : (
        <Stack spacing={1} alignItems="center" sx={{ p: 3, textAlign: 'center' }}>
          <SlideshowOutlinedIcon sx={{ color: '#ffffff' }} />
          <Typography sx={{ color: '#ffffff' }}>No slide preview image is available.</Typography>
        </Stack>
      )}

      {slide && <SlideOnlyIndicator slide={slide} slideCount={slideCount} />}
    </Box>
  );
}

function SlideOnlyIndicator({ slide, slideCount }) {
  return (
    <Box
      sx={{
        position: 'fixed',
        left: 20,
        bottom: 20,
        zIndex: 1400,
        px: 2,
        py: 1,
        borderRadius: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        color: '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.28)',
        boxShadow: '0 8px 28px rgba(0, 0, 0, 0.38)',
        maxWidth: 'min(520px, calc(100vw - 40px))',
        boxSizing: 'border-box',
        textAlign: 'left',
      }}
    >
      <Typography
        variant="body1"
        sx={{
          color: 'inherit',
          fontWeight: 800,
          lineHeight: 1.2,
        }}
      >
        Slide {slide.slideNumber}
        {slideCount > 0 ? ` of ${slideCount}` : ''}
      </Typography>
      {slide.title && (
        <Typography
          variant="body2"
          sx={{
            color: 'rgba(255, 255, 255, 0.84)',
            lineHeight: 1.25,
            mt: 0.25,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {slide.title}
        </Typography>
      )}
    </Box>
  );
}

export default FullPageSlide;
