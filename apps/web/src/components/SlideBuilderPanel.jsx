import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AccessibilityChecklistEditor from './AccessibilityChecklistEditor';
import PriorityQueueEditor from './PriorityQueueEditor';
import TimingGoalEditor from './TimingGoalEditor';

function SlideBuilderPanel({ slide, onUpdateSlide }) {
  if (!slide) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          border: '1px solid var(--border, #e5e4e7)',
          backgroundColor: 'var(--surface-raised, #ffffff)',
        }}
      >
        <Typography sx={{ color: 'var(--text-muted)' }}>
          Select a slide to edit its builder schema.
        </Typography>
      </Paper>
    );
  }

  function updateBuildData(updates) {
    onUpdateSlide(slide.slideId, {
      ...slide.buildData,
      ...updates,
    });
  }

  return (
    <Stack spacing={2.5}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          border: '1px solid var(--border, #e5e4e7)',
          backgroundColor: 'var(--surface-raised, #ffffff)',
        }}
      >
        <Stack spacing={1.5}>
          <Typography variant="overline" sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>
            Slide {slide.slideNumber}
          </Typography>

          <Typography variant="h4" sx={{ color: 'var(--text-h)' }}>
            {slide.title || 'Untitled slide'}
          </Typography>

          <Divider />

          <Box>
            <Typography variant="h6" sx={{ color: 'var(--text-h)', mb: 1 }}>
              Slide Text
            </Typography>

            <Stack spacing={0.75}>
              {(slide.slideText ?? []).map((text, index) => (
                <Typography key={`${text}-${index}`} variant="body2" sx={{ color: 'var(--text)' }}>
                  {text}
                </Typography>
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ color: 'var(--text-h)', mb: 1 }}>
              Speaker Notes
            </Typography>

            <Typography
              variant="body2"
              sx={{
                color: 'var(--text)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {slide.speakerNotes || 'No speaker notes for this slide.'}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: 3,
          border: '1px solid var(--border, #e5e4e7)',
          backgroundColor: 'var(--surface-raised, #ffffff)',
        }}
      >
        <PriorityQueueEditor
          items={slide.buildData?.priorityItems ?? []}
          onChange={(priorityItems) => updateBuildData({ priorityItems })}
        />
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: 3,
          border: '1px solid var(--border, #e5e4e7)',
          backgroundColor: 'var(--surface-raised, #ffffff)',
        }}
      >
        <AccessibilityChecklistEditor
          items={slide.buildData?.accessibilityChecks ?? []}
          onChange={(accessibilityChecks) => updateBuildData({ accessibilityChecks })}
        />
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: 3,
          border: '1px solid var(--border, #e5e4e7)',
          backgroundColor: 'var(--surface-raised, #ffffff)',
        }}
      >
        <TimingGoalEditor
          value={slide.buildData?.timingGoal ?? { minutes: 1, seconds: 0 }}
          onChange={(timingGoal) => updateBuildData({ timingGoal })}
        />
      </Paper>
    </Stack>
  );
}

export default SlideBuilderPanel;
