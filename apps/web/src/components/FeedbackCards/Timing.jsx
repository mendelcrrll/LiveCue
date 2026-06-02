import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FeedbackCardShell from './FeedbackCardShell';

function TimingCard({ timingSummary, expanded, ...cardProps }) {
  const slideTimings = getSlideTimings(timingSummary);
  const totalSeconds = Math.round(Number(timingSummary?.durationMs ?? 0) / 1000);

  return (
    <FeedbackCardShell title="Timing" expanded={expanded} {...cardProps}>
      <Box sx={{ height: '100%', p: expanded ? 2.5 : 0.75, minHeight: 0 }}>
        {slideTimings.length === 0 ? (
          <EmptyTimingState />
        ) : (
          <Box
            sx={{
              display: expanded ? 'grid' : 'block',
              gridTemplateColumns: expanded ? 'minmax(0, 1.7fr) minmax(260px, 0.9fr)' : 'none',
              gap: expanded ? 3 : 0,
              height: '100%',
              minHeight: 0,
            }}
          >
            <TimingSplitChart
              expanded={expanded}
              slideTimings={slideTimings}
              totalSeconds={totalSeconds}
            />
          {expanded && (
            <TimingContextPanel
              slideTimings={slideTimings}
              totalSeconds={totalSeconds}
            />
          )}
          </Box>
        )}
      </Box>
    </FeedbackCardShell>
  );
}

function EmptyTimingState() {
  return (
    <Stack
      spacing={1}
      alignItems="center"
      justifyContent="center"
      sx={{ height: '100%', minHeight: 180, textAlign: 'center', color: 'var(--text-muted)' }}
    >
      <Typography variant="subtitle2" sx={{ color: 'var(--text-h)', fontWeight: 800 }}>
        No timing data yet
      </Typography>
      <Typography variant="body2">
        Record and end a presentation session to review timing by slide.
      </Typography>
    </Stack>
  );
}

function TimingSplitChart({ expanded, slideTimings, totalSeconds }) {
  const chartSlides = slideTimings.slice(0, expanded ? 24 : 14);
  const values = chartSlides.map((slide) => slide.durationMs / 1000);
  const maxValue = Math.max(90, ...values);
  const maxDomain = Math.ceil((maxValue + 12) / 15) * 15;
  const ticks = getTicks(0, maxDomain);
  const plot = {
    left: expanded ? 48 : 42,
    right: expanded ? 82 : 54,
    top: expanded ? 18 : 10,
    bottom: expanded ? 34 : 22,
    width: expanded ? 360 : 520,
    height: expanded ? 210 : 230,
  };
  const plotWidth = plot.width - plot.left - plot.right;
  const plotHeight = plot.height - plot.top - plot.bottom;
  const bandWidth = plotWidth / Math.max(1, chartSlides.length);
  const barWidth = Math.max(4, Math.min(expanded ? 34 : 30, bandWidth * 0.78));

  return (
    <Box sx={{ display: 'grid', placeItems: 'stretch', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Box
        component="svg"
        viewBox={`0 0 ${plot.width} ${plot.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Timing by slide, total ${formatDuration(totalSeconds)}`}
        sx={{
          display: 'block',
          width: '100%',
          height: '100%',
          aspectRatio: `${plot.width} / ${plot.height}`,
          maxHeight: '100%',
        }}
      >
        <rect x={plot.left} y={plot.top} width={plotWidth} height={plotHeight} fill="var(--surface)" opacity="0.65" />

        {ticks.map((tick) => {
          const y = valueToY(tick, 0, maxDomain, plot, plotHeight);
          return (
            <g key={tick}>
              <line x1={plot.left} x2={plot.left + plotWidth} y1={y} y2={y} stroke="var(--border)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
              <text x={plot.left - 8} y={y + 3} fill="var(--text-muted)" fontSize={expanded ? 10 : 9} textAnchor="end">
                {tick}
              </text>
            </g>
          );
        })}

        <line x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.top + plotHeight} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
        <line x1={plot.left} x2={plot.left + plotWidth} y1={plot.top + plotHeight} y2={plot.top + plotHeight} stroke="var(--border)" vectorEffect="non-scaling-stroke" />

        {chartSlides.map((slide, index) => {
          const seconds = slide.durationMs / 1000;
          const x = plot.left + index * bandWidth + (bandWidth - barWidth) / 2;
          const y = valueToY(seconds, 0, maxDomain, plot, plotHeight);
          const barHeight = plot.top + plotHeight - y;
          const goalY = slide.goalMs > 0 ? valueToY(slide.goalMs / 1000, 0, maxDomain, plot, plotHeight) : null;
          return (
            <g key={slide.slideId}>
              {goalY !== null && (
                <line x1={x - 2} x2={x + barWidth + 2} y1={goalY} y2={goalY} stroke="var(--text-h)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              )}
              <rect x={x} y={y} width={barWidth} height={barHeight} fill={getTimingColor(slide.status)} rx="2" />
              {(expanded || chartSlides.length <= 8) && (
                <text x={x + barWidth / 2} y={plot.top + plotHeight + 13} fill="var(--text-muted)" fontSize={expanded ? 10 : 9} textAnchor="middle">
                  {slide.slideNumber}
                </text>
              )}
            </g>
          );
        })}

        <text x={plot.left + plotWidth + 10} y={plot.top + 32} fill="var(--text-h)" fontSize={expanded ? 18 : 17} fontWeight="700">
          {formatDuration(totalSeconds)}
        </text>
        <text x={plot.left + plotWidth + 10} y={plot.top + 46} fill="var(--text-muted)" fontSize={expanded ? 10 : 9}>
          total
        </text>
        {expanded && (
          <>
            <text x={plot.left} y={plot.height - 4} fill="var(--text-muted)" fontSize="10">
              slide
            </text>
            <text x={plot.left - 26} y={plot.top - 5} fill="var(--text-muted)" fontSize="10">
              sec
            </text>
          </>
        )}
      </Box>
    </Box>
  );
}

function TimingContextPanel({ slideTimings, totalSeconds }) {
  const under = slideTimings.filter((slide) => slide.status === 'under_time').length;
  const over = slideTimings.filter((slide) => slide.status === 'over_time').length;
  const onTrack = slideTimings.length - under - over;

  return (
    <Stack
      spacing={2}
      sx={{
        minWidth: 0,
        p: 2,
        border: '1px solid var(--border)',
        borderRadius: 2,
        backgroundColor: 'var(--surface)',
        color: 'var(--text)',
      }}
    >
      <Box>
        <Typography variant="overline" sx={{ color: 'var(--text-muted)', letterSpacing: 0 }}>
          Model context
        </Typography>
        <Typography variant="h5" sx={{ color: 'var(--text-h)', fontWeight: 800 }}>
          {formatDuration(totalSeconds)}
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ color: 'var(--text)' }}>
        {getTimingSummary(under, over)}
      </Typography>
      <Stack spacing={1}>
        <ContextStat label="On track" value={onTrack} />
        <ContextStat label="Under time" value={under} />
        <ContextStat label="Over time" value={over} />
      </Stack>
    </Stack>
  );
}

function ContextStat({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ gap: 2, py: 0.75, borderBottom: '1px solid var(--border)' }}>
      <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--text-h)', fontWeight: 700 }}>
        {value}
      </Typography>
    </Stack>
  );
}

function getSlideTimings(summary) {
  const slides = Array.isArray(summary?.slides) ? summary.slides : [];
  return slides
    .map((slide, index) => ({
      slideId: slide.slideId ?? `slide-${index}`,
      slideNumber: slide.slideNumber ?? index + 1,
      durationMs: Number(slide.durationMs ?? 0),
      goalMs: Number(slide.goalMs ?? 0),
      status: slide.status ?? 'unknown',
    }))
    .filter((slide) => Number.isFinite(slide.durationMs) && slide.durationMs > 0);
}

function valueToY(value, minDomain, maxDomain, plot, plotHeight) {
  const percent = (value - minDomain) / Math.max(1, maxDomain - minDomain);
  return plot.top + plotHeight - percent * plotHeight;
}

function getTicks(minDomain, maxDomain) {
  const step = Math.max(15, Math.ceil((maxDomain - minDomain) / 4 / 15) * 15);
  const ticks = [];
  for (let tick = minDomain; tick <= maxDomain; tick += step) {
    ticks.push(tick);
  }
  return ticks;
}

function getTimingColor(status) {
  if (status === 'under_time') {
    return '#d5ad36';
  }
  if (status === 'over_time') {
    return '#c64b4b';
  }
  return '#639d2f';
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getTimingSummary(under, over) {
  if (over > under) {
    return 'A few slides are running long. Consider tightening those sections.';
  }
  if (under > over) {
    return 'Some slides are moving quickly. A little more context may help.';
  }
  return 'Slide timing looks balanced overall.';
}

export default TimingCard;
