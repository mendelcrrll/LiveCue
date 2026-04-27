import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

function SlideNavigator({ slides = [], activeSlideId = null, onSelectSlide }) {
  const sortedSlides = [...slides].sort(
    (a, b) => a.slideNumber - b.slideNumber
  );

  return (
    <Stack spacing={1}>
      <Typography variant="h6" sx={{ color: 'var(--text-h)' }}>
        Slides
      </Typography>

      <Stack spacing={1}>
        {sortedSlides.map((slide) => {
          const isActive = slide.slideId === activeSlideId;
          const slideImage = slide.thumbnailUrl ?? slide.imageUrl;

          return (
            <ButtonBase
              key={slide.slideId}
              onClick={() => onSelectSlide(slide.slideId)}
              sx={{
                width: '100%',
                display: 'block',
                textAlign: 'left',
                borderRadius: 2,
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  width: '100%',
                  p: 1,
                  borderRadius: 2,
                  border: isActive
                    ? '2px solid var(--primary, #492e7d)'
                    : '1px solid var(--border, #e5e4e7)',
                  backgroundColor: isActive
                    ? 'var(--interactive-bg, #e8def8)'
                    : 'var(--surface-raised, #ffffff)',
                }}
              >
                <Stack spacing={1}>
                  <Box
                    sx={{
                      width: '100%',
                      aspectRatio: '16 / 9',
                      borderRadius: 1.5,
                      overflow: 'hidden',
                      backgroundColor: 'var(--surface, #f7f4fb)',
                      border: '1px solid var(--border, #e5e4e7)',
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
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <Typography
                        variant="caption"
                        sx={{ color: 'var(--text-muted)' }}
                      >
                        No preview
                      </Typography>
                    )}
                  </Box>

                  <Stack spacing={0.25}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'var(--text-muted)',
                        fontWeight: 700,
                      }}
                    >
                      Slide {slide.slideNumber}
                    </Typography>

                    <Typography
                      variant="body2"
                      sx={{
                        color: 'var(--text-h)',
                        fontWeight: isActive ? 700 : 500,
                      }}
                    >
                      {slide.title || 'Untitled slide'}
                    </Typography>
                  </Stack>
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
