import ButtonBase from '@mui/material/ButtonBase';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { sortSlidesByNumber } from '../utils/slideUtils';
import SlidePreview from './SlidePreview';

function SlideNavigator({ slides = [], activeSlideId = null, onSelectSlide }) {
  const sortedSlides = sortSlidesByNumber(slides);

  return (
    <Stack spacing={1}>
      <Typography variant="h6" sx={{ color: 'var(--text-h)' }}>
        Slides
      </Typography>

      <Stack spacing={1} alignItems="center">
        {sortedSlides.map((slide) => {
          const isActive = slide.slideId === activeSlideId;

          return (
            <ButtonBase
              key={slide.slideId}
              onClick={() => onSelectSlide(slide.slideId)}
              sx={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                textAlign: 'left',
                borderRadius: 2,
                boxSizing: 'border-box',
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  width: '100%',
                  p: 1,
                  borderRadius: 2,
                  boxSizing: 'border-box',
                  border: isActive
                    ? '2px solid var(--primary, #492e7d)'
                    : '1px solid var(--border, #e5e4e7)',
                  backgroundColor: isActive
                    ? 'var(--interactive-bg, #e8def8)'
                    : 'var(--surface-raised, #ffffff)',
                }}
              >
                <Stack spacing={1}>
                  <SlidePreview slide={slide} borderRadius={1.5} />

                  <Typography
                    variant="body2"
                    sx={{
                      color: 'var(--text-h)',
                      fontWeight: isActive ? 700 : 500,
                    }}
                  >
                    {slide.title || `Slide ${slide.slideNumber}`}
                  </Typography>
                </Stack>
              </Paper>
            </ButtonBase>
          );
        })}
      </Stack>
    </Stack>
  );
}

export default SlideNavigator;
