import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FeedbackCardShell from './FeedbackCardShell';

const SLOW_WPM = 110;
const FAST_WPM = 160;
const MOCK_SLIDE_PACES = [
  { slideId: 'mock-slide-1', slideNumber: 1, wordsPerMinute: 118 },
  { slideId: 'mock-slide-2', slideNumber: 2, wordsPerMinute: 142 },
  { slideId: 'mock-slide-3', slideNumber: 3, wordsPerMinute: 154 },
  { slideId: 'mock-slide-4', slideNumber: 4, wordsPerMinute: 101 },
  { slideId: 'mock-slide-5', slideNumber: 5, wordsPerMinute: 168 },
  { slideId: 'mock-slide-6', slideNumber: 6, wordsPerMinute: 137 },
];

function PaceCard({ summary, expanded, ...cardProps }) {
  const realSlidePaces = getSlidePaces(summary);
  const slidePaces = realSlidePaces.length > 0 ? realSlidePaces : MOCK_SLIDE_PACES;
  const averagePace =
    realSlidePaces.length > 0
      ? Number(summary?.wordsPerMinute ?? 0)
      : Math.round(
          MOCK_SLIDE_PACES.reduce((total, slide) => total + slide.wordsPerMinute, 0) /
            MOCK_SLIDE_PACES.length
        );

  return (
    <FeedbackCardShell title="Pace" expanded={expanded} {...cardProps}>
      <Box sx={{ height: '100%', p: expanded ? 2.5 : 0.75, minHeight: 0 }}>
        <Box
          sx={{
            display: expanded ? 'grid' : 'block',
            gridTemplateColumns: expanded ? 'minmax(0, 1.7fr) minmax(260px, 0.9fr)' : 'none',
            gap: expanded ? 3 : 0,
            height: '100%',
            minHeight: 0,
            alignItems: 'stretch',
          }}
        >
          <PaceSplitChart
            averagePace={averagePace}
            expanded={expanded}
            isMock={realSlidePaces.length === 0}
            slidePaces={slidePaces}
          />
          {expanded && (
            <PaceContextPanel
              averagePace={averagePace}
              isMock={realSlidePaces.length === 0}
              slidePaces={slidePaces}
              summary={summary}
            />
          )}
        </Box>
      </Box>
    </FeedbackCardShell>
  );
}

function PaceSplitChart({ averagePace, expanded, isMock, slidePaces }) {
  const chartSlides = slidePaces.slice(0, expanded ? 24 : 14);
  const values = chartSlides.map((slide) => slide.wordsPerMinute);
  const minValue = Math.min(90, ...values, averagePace);
  const maxValue = Math.max(180, ...values, averagePace);
  const minDomain = Math.max(0, Math.floor((minValue - 12) / 10) * 10);
  const maxDomain = Math.ceil((maxValue + 12) / 10) * 10;
  const ticks = getTicks(minDomain, maxDomain);
  const plot = {
    left: expanded ? 48 : 42,
    right: expanded ? 82 : 48,
    top: expanded ? 18 : 10,
    bottom: expanded ? 34 : 22,
    width: expanded ? 360 : 520,
    height: expanded ? 210 : 230,
  };
  const plotWidth = plot.width - plot.left - plot.right;
  const plotHeight = plot.height - plot.top - plot.bottom;
  const bandWidth = plotWidth / Math.max(1, chartSlides.length);
  const barWidth = Math.max(4, Math.min(expanded ? 34 : 26, bandWidth * 0.78));
  const averageY = valueToY(averagePace, minDomain, maxDomain, plot, plotHeight);

  return (
    <Box
      sx={{
        display: 'grid',
        placeItems: 'stretch',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Box
        component="svg"
        viewBox={`0 0 ${plot.width} ${plot.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Pace by slide, average ${Math.round(averagePace)} words per minute`}
        sx={{
          display: 'block',
          width: '100%',
          height: '100%',
          aspectRatio: `${plot.width} / ${plot.height}`,
          maxHeight: '100%',
          transform: 'none',
        }}
      >
        <rect
          x={plot.left}
          y={plot.top}
          width={plotWidth}
          height={plotHeight}
          fill="var(--surface)"
          opacity="0.65"
        />

        {ticks.map((tick) => {
          const y = valueToY(tick, minDomain, maxDomain, plot, plotHeight);
          return (
            <g key={tick}>
              <line
                x1={plot.left}
                x2={plot.left + plotWidth}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="2 4"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={plot.left - 8}
                y={y + 3}
                fill="var(--text-muted)"
                fontSize={expanded ? 10 : 9}
                textAnchor="end"
              >
                {tick}
              </text>
            </g>
          );
        })}

        <line
          x1={plot.left}
          x2={plot.left}
          y1={plot.top}
          y2={plot.top + plotHeight}
          stroke="var(--border)"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={plot.left}
          x2={plot.left + plotWidth}
          y1={plot.top + plotHeight}
          y2={plot.top + plotHeight}
          stroke="var(--border)"
          vectorEffect="non-scaling-stroke"
        />

        {chartSlides.map((slide, index) => {
          const x = plot.left + index * bandWidth + (bandWidth - barWidth) / 2;
          const y = valueToY(slide.wordsPerMinute, minDomain, maxDomain, plot, plotHeight);
          const barHeight = plot.top + plotHeight - y;
          return (
            <g key={slide.slideId}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={getPaceColor(slide.wordsPerMinute)}
                rx="2"
              />
              {(expanded || chartSlides.length <= 8) && (
                <text
                  x={x + barWidth / 2}
                  y={plot.top + plotHeight + 13}
                  fill="var(--text-muted)"
                  fontSize={expanded ? 10 : 9}
                  textAnchor="middle"
                >
                  {slide.slideNumber}
                </text>
              )}
            </g>
          );
        })}

        <line
          x1={plot.left}
          x2={plot.left + plotWidth}
          y1={averageY}
          y2={averageY}
          stroke="var(--text-h)"
          strokeDasharray="5 5"
          vectorEffect="non-scaling-stroke"
        />

        <text
          x={plot.left + plotWidth + 10}
          y={averageY - 6}
          fill="var(--text-h)"
          fontSize={expanded ? 18 : 17}
          fontWeight="700"
        >
          {Math.round(averagePace)}
        </text>
        <text
          x={plot.left + plotWidth + 10}
          y={averageY + 8}
          fill="var(--text-muted)"
          fontSize={expanded ? 10 : 9}
        >
          {isMock ? 'mock avg' : 'avg WPM'}
        </text>
        {expanded && (
          <>
            <text x={plot.left} y={plot.height - 4} fill="var(--text-muted)" fontSize="10">
              slide
            </text>
            <text x={plot.left - 26} y={plot.top - 5} fill="var(--text-muted)" fontSize="10">
              WPM
            </text>
          </>
        )}
      </Box>
    </Box>
  );
}

function PaceContextPanel({ averagePace, isMock, slidePaces, summary }) {
  const slowSlides = slidePaces.filter((slide) => slide.wordsPerMinute < SLOW_WPM);
  const fastSlides = slidePaces.filter((slide) => slide.wordsPerMinute > FAST_WPM);
  const steadySlides = slidePaces.length - slowSlides.length - fastSlides.length;

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
          {isMock ? 'Preview insight' : 'Model context'}
        </Typography>
        <Typography variant="h5" sx={{ color: 'var(--text-h)', fontWeight: 800 }}>
          {Math.round(averagePace)} WPM
        </Typography>
      </Box>

      <Typography variant="body2" sx={{ color: 'var(--text)' }}>
        {getPaceSummary(averagePace, slowSlides.length, fastSlides.length)}
      </Typography>

      <Stack spacing={1}>
        <ContextStat label="Steady slides" value={steadySlides} />
        <ContextStat label="Slow slides" value={slowSlides.length} />
        <ContextStat label="Fast slides" value={fastSlides.length} />
        <ContextStat label="Transcript chunks" value={summary?.chunkCount ?? 0} />
      </Stack>
    </Stack>
  );
}

function ContextStat({ label, value }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{
        gap: 2,
        py: 0.75,
        borderBottom: '1px solid var(--border)',
      }}
    >
      <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--text-h)', fontWeight: 700 }}>
        {value}
      </Typography>
    </Stack>
  );
}

function getSlidePaces(summary) {
  const slides = Array.isArray(summary?.slides) ? summary.slides : [];

  return slides
    .map((slide, index) => ({
      slideId: slide.slideId ?? `slide-${index}`,
      slideNumber: slide.slideNumber ?? index + 1,
      wordsPerMinute: Number(slide.wordsPerMinute ?? 0),
    }))
    .filter((slide) => Number.isFinite(slide.wordsPerMinute) && slide.wordsPerMinute > 0);
}

function valueToY(value, minDomain, maxDomain, plot, plotHeight) {
  const percent = (value - minDomain) / Math.max(1, maxDomain - minDomain);
  return plot.top + plotHeight - percent * plotHeight;
}

function getTicks(minDomain, maxDomain) {
  const step = Math.max(10, Math.ceil((maxDomain - minDomain) / 4 / 10) * 10);
  const ticks = [];

  for (let tick = minDomain; tick <= maxDomain; tick += step) {
    ticks.push(tick);
  }

  return ticks;
}

function getPaceColor(wordsPerMinute) {
  if (wordsPerMinute < SLOW_WPM) {
    return '#d5ad36';
  }

  if (wordsPerMinute > FAST_WPM) {
    return '#c64b4b';
  }

  return '#639d2f';
}

function getPaceSummary(averagePace, slowCount, fastCount) {
  if (fastCount > slowCount) {
    return 'A few sections are moving quickly. Consider adding pauses after key points.';
  }

  if (slowCount > fastCount) {
    return 'Some sections are slower than the target pace. Tightening transitions may help.';
  }

  if (averagePace >= SLOW_WPM && averagePace <= FAST_WPM) {
    return 'Overall pace is in the target range, with balanced slide-to-slide variation.';
  }

  return 'Pace is usable, but the slide split pattern has room to smooth out.';
}

export default PaceCard;
