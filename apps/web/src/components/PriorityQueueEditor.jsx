import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteIcon from '@mui/icons-material/Delete';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

const CATEGORY_OPTIONS = [
  { value: 'must_say', label: 'Must say' },
  { value: 'explain', label: 'Explain' },
  { value: 'accessibility', label: 'Accessibility' },
  { value: 'timing', label: 'Timing' },
  { value: 'custom', label: 'Custom' },
];

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

function PriorityQueueEditor({ items = [], onChange }) {
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
        category: 'custom',
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
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h6" sx={{ color: 'var(--text-h)' }}>
            Presentation Goals
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
            Prioritize what the presenter should remember for this slide.
          </Typography>
        </Box>

        <IconButton aria-label="Add presentation goal" onClick={addItem}>
          <AddIcon />
        </IconButton>
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

            <TextField
              select
              label="Category"
              value={item.category}
              onChange={(event) =>
                updateItem(item.id, {
                  category: event.target.value,
                })
              }
              size="small"
              sx={{ width: 170 }}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

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
    </Stack>
  );
}

export default PriorityQueueEditor;
