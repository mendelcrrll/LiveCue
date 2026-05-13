import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteIcon from '@mui/icons-material/Delete';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

let nextPriorityItemId = 0;

function createPriorityItemId() {
  nextPriorityItemId += 1;
  return `priority-${nextPriorityItemId}`;
}

function normalizePriorities(items) {
  return items.map((item, index) => ({
    ...item,
    priority: index + 1,
  }));
}

const addGoalRowSx = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  borderRadius: 1,
  textAlign: 'left',
  color: 'var(--text-muted)',
  '& .add-goal-placeholder': {
    minHeight: 40,
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    px: 1.5,
    borderRadius: 1,
    border: '1px dashed var(--interactive-border, #8e72bf)',
    backgroundColor: 'color-mix(in srgb, var(--surface, #f7f4fb) 70%, transparent)',
    transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
  },
  '&:hover': {
    color: 'var(--text-h)',
  },
  '&:hover .add-goal-placeholder, &:focus-visible .add-goal-placeholder': {
    borderColor: 'var(--interactive-border, #8e72bf)',
    backgroundColor: 'var(--interactive-bg-hover, #ddd0f5)',
  },
};

function PriorityQueueEditor({ items = [], onChange, isGenerating = false }) {
  const sortedItems = [...items].sort((a, b) => a.priority - b.priority);

  function updateItems(nextItems) {
    onChange(normalizePriorities(nextItems));
  }

  function addItem() {
    updateItems([
      ...sortedItems,
      {
        id: createPriorityItemId(),
        text: '',
        priority: sortedItems.length + 1,
      },
    ]);
  }

  function updateItem(id, updates) {
    updateItems(
      sortedItems.map((item) =>
        item.id === id
          ? {
              ...item,
              ...updates,
            }
          : item
      )
    );
  }

  function deleteItem(id) {
    updateItems(sortedItems.filter((item) => item.id !== id));
  }

  function moveItem(id, direction) {
    const currentIndex = sortedItems.findIndex((item) => item.id === id);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sortedItems.length) {
      return;
    }

    const nextItems = [...sortedItems];
    const [movedItem] = nextItems.splice(currentIndex, 1);
    nextItems.splice(nextIndex, 0, movedItem);

    updateItems(nextItems);
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        sx={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr',
        }}
      >
        <Box sx={{ minWidth: 0, width: '100%', textAlign: 'center' }}>
          <Typography variant="h6" sx={{ color: 'var(--text-h)' }}>
            Presentation Goals
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
            {isGenerating
              ? 'Generating goals, timing, and accessibility checks...'
              : 'Prioritize what the presenter should remember for this slide.'}
          </Typography>
        </Box>
      </Stack>

      <Stack spacing={1.5}>
        {sortedItems.map((item, index) => (
          <Stack
            key={item.id}
            direction="row"
            spacing={1.5}
            alignItems="center"
          >
            <Typography
              variant="body2"
              sx={{
                width: 28,
                fontWeight: 700,
                color: 'var(--text-muted)',
              }}
            >
              {index + 1}
            </Typography>

            <TextField
              label="Goal"
              value={item.text}
              onChange={(event) =>
                updateItem(item.id, {
                  text: event.target.value,
                })
              }
              size="small"
              fullWidth
            />

            <IconButton
              aria-label={`Move ${item.text || 'goal'} up`}
              onClick={() => moveItem(item.id, -1)}
              disabled={index === 0}
            >
              <ArrowUpwardIcon />
            </IconButton>

            <IconButton
              aria-label={`Move ${item.text || 'goal'} down`}
              onClick={() => moveItem(item.id, 1)}
              disabled={index === sortedItems.length - 1}
            >
              <ArrowDownwardIcon />
            </IconButton>

            <IconButton
              aria-label={`Delete ${item.text || 'goal'}`}
              onClick={() => deleteItem(item.id)}
            >
              <DeleteIcon />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <ButtonBase aria-label="Add presentation goal" onClick={addItem} sx={addGoalRowSx}>
        <Box className="add-goal-placeholder">
          <AddIcon fontSize="small" />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Add presentation goal
          </Typography>
        </Box>
      </ButtonBase>
    </Stack>
  );
}

export default PriorityQueueEditor;
