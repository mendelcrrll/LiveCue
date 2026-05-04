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
          sx={{
            width: 'min(100vw, calc(100vh * 16 / 9))',
            height: 'min(100vh, calc(100vw * 9 / 16))',
            aspectRatio: '16 / 9',
            backgroundColor: '#E3DFD6',
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
          }}
        >
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
        </Box>
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
        left: 3,
        bottom: 3,
        zIndex: 1400,
        px: 1.2,
        py: 0.45,
        borderRadius: 0.75,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        color: '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.28)',
        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.32)',
        maxWidth: 'min(320px, calc(100vw - 20px))',
        boxSizing: 'border-box',
        textAlign: 'left',
      }}
    >
      <Typography
        variant="body1"
        sx={{
          color: 'inherit',
          fontWeight: 800,
          fontSize: '0.82rem',
          lineHeight: 1.1,
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
            fontSize: '0.72rem',
            lineHeight: 1.15,
            mt: 0.15,
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
