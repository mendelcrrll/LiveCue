import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AccessibilityChecklistEditor from './AccessibilityChecklistEditor';
import PriorityQueueEditor from './PriorityQueueEditor';
import TimingGoalEditor from './TimingGoalEditor';

const builderPanelControlSx = {
  color: 'var(--text)',
  '& .MuiInputBase-root': {
    color: 'var(--text)',
    backgroundColor: 'var(--surface, #f7f4fb)',
  },
  '& .MuiInputLabel-root': {
    color: 'var(--text-muted)',
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: 'var(--interactive-border)',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--border)',
  },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--interactive-border)',
  },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--interactive-border)',
  },
  '& .MuiFormControlLabel-label': {
    color: 'var(--text)',
  },
  '& .MuiCheckbox-root': {
    color: 'var(--text-muted)',
  },
  '& .MuiCheckbox-root.Mui-checked': {
    color: 'var(--interactive-border)',
  },
  '& .MuiIconButton-root': {
    color: 'var(--text-muted)',
  },
  '& .MuiIconButton-root:hover': {
    color: 'var(--text-h)',
    backgroundColor: 'var(--interactive-bg)',
  },
  '& .MuiIconButton-root.Mui-disabled': {
    color: 'color-mix(in srgb, var(--text-muted) 45%, transparent)',
  },
  '& .MuiSvgIcon-root': {
    color: 'inherit',
  },
};

function SlideBuilderPanel({ slide, onUpdateSlide }) {
  if (!slide) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          border: '1px solid var(--border, #e5e4e7)',
          backgroundColor: 'var(--surface-raised, #ffffff)',
          ...builderPanelControlSx,
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
    <Stack spacing={2.5} sx={builderPanelControlSx}>
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
