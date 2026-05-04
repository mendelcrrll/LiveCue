import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

function TimingGoalEditor({ value = { minutes: 1, seconds: 0 }, onChange }) {
  const minutes = value.minutes ?? 0;
  const seconds = value.seconds ?? 0;

  function updateTiming(nextValue) {
    const normalizedSeconds = Math.min(59, Math.max(0, nextValue.seconds));
    const normalizedMinutes = Math.max(0, nextValue.minutes);

    if (normalizedMinutes === 0 && normalizedSeconds === 0) {
      return;
    }

    onChange({
      minutes: normalizedMinutes,
      seconds: normalizedSeconds,
    });
  }

  function handleMinutesChange(event) {
    updateTiming({
      minutes: Number(event.target.value),
      seconds,
    });
  }

  function handleSecondsChange(event) {
    updateTiming({
      minutes,
      seconds: Number(event.target.value),
    });
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="h6" sx={{ color: 'var(--text-h)' }}>
        Timing Goal
      </Typography>

      <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
        Set how long you want to spend presenting this slide.
      </Typography>

      <Stack direction="row" spacing={2}>
        <TextField
          label="Minutes"
          type="number"
          value={minutes}
          onChange={handleMinutesChange}
          size="small"
          inputProps={{ min: 0 }}
        />

        <TextField
          label="Seconds"
          type="number"
          value={seconds}
          onChange={handleSecondsChange}
          size="small"
          inputProps={{ min: 0, max: 59 }}
        />
      </Stack>
    </Stack>
  );
}

export default TimingGoalEditor;
