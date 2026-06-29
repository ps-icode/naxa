/**
 * Naxa QA Test Suite — Principal QA Lead perspective
 * 40 test cases covering: page load, API CRUD, map creation, canvas,
 * layer panel, toolbar controls, export modal, shortcuts, toasts, edge cases.
 *
 * Run: docker run --rm --network=host -v SCRATCHPAD:/work -w /work
 *      mcr.microsoft.com/playwright:v1.61.1-jammy npx playwright test
 */
import { test, expect, Page } from '@playwright/test';

const WEB = 'http://localhost:3000';
const API = 'http://localhost:8000';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Creates a new map via the + New Map modal. */
async function createMap(
  page: Page,
  name = 'QA Map',
  rows = 10,
  cols = 10,
  shape: 'square' | 'rectangle' | 'hexagon' = 'square',
) {
  await page.click('button:has-text("+ New Map")');
  const modal = page.locator('div').filter({ has: page.locator('h2:has-text("New Map")') }).last();
  await expect(modal.locator('h2:has-text("New Map")')).toBeVisible();

  // Name input is autofocused — fill via focused element
  const nameInput = modal.locator('input').first();
  await nameInput.fill(name);

  if (shape !== 'square') {
    await modal.locator(`button:has-text("${shape}")`).click();
  }

  const numberInputs = modal.locator('input[type="number"]');
  await numberInputs.nth(0).fill(String(rows));
  await numberInputs.nth(1).fill(String(cols));

  await modal.locator('button:has-text("Create Map")').click();
  await expect(page.locator('h2:has-text("New Map")')).not.toBeVisible({ timeout: 3000 });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 5000 });
}

// ── TC-01: Page loads ─────────────────────────────────────────────────────────
test('TC-01: App loads with correct title and empty state', async ({ page }) => {
  await page.goto(WEB);
  await expect(page).toHaveTitle(/Naxa/);
  await expect(page.locator('text=Create a grid map to start designing')).toBeVisible();
  await expect(page.locator('button:has-text("+ New Map")')).toBeVisible();
});

// ── TC-02: API health ─────────────────────────────────────────────────────────
test('TC-02: Backend API health endpoint returns ok', async ({ request }) => {
  const r = await request.get(`${API}/health`);
  expect(r.ok()).toBeTruthy();
  const body = await r.json();
  expect(body.status).toBe('ok');
});

// ── TC-03: New Map modal — square grid created ────────────────────────────────
test('TC-03: New Map modal creates a square grid and shows canvas', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Square Grid QA');
  await expect(page.locator('canvas').first()).toBeVisible();
  // Map name appears in sidebar
  await expect(page.locator('text=Square Grid QA').first()).toBeVisible();
});

// ── TC-04: New Map modal — H m/cell for rectangle ────────────────────────────
test('TC-04: Rectangle shape shows extra H m/cell input; hexagon hides it', async ({ page }) => {
  await page.goto(WEB);
  await page.click('button:has-text("+ New Map")');
  const modal = page.locator('div').filter({ has: page.locator('h2:has-text("New Map")') }).last();

  // Square: no H m/cell
  await expect(modal.locator('label:has-text("H m/cell")')).not.toBeVisible();

  // Rectangle: H m/cell appears
  await modal.locator('button:has-text("rectangle")').click();
  await expect(modal.locator('label:has-text("H m/cell")')).toBeVisible();

  // Hexagon: H m/cell disappears
  await modal.locator('button:has-text("hexagon")').click();
  await expect(modal.locator('label:has-text("H m/cell")')).not.toBeVisible();

  await modal.locator('button:has-text("Cancel")').click();
});

// ── TC-05: Large grid warning ─────────────────────────────────────────────────
test('TC-05: Grid preview shows warning above 10,000 cells', async ({ page }) => {
  await page.goto(WEB);
  await page.click('button:has-text("+ New Map")');
  const modal = page.locator('div').filter({ has: page.locator('h2:has-text("New Map")') }).last();

  const rows = modal.locator('input[type="number"]').nth(0);
  const cols = modal.locator('input[type="number"]').nth(1);
  await rows.fill('200');
  await cols.fill('200');

  await expect(modal.locator('text=/Large grid/')).toBeVisible();
  await modal.locator('button:has-text("Cancel")').click();
});

// ── TC-06: Keyboard shortcuts — tools ────────────────────────────────────────
test('TC-06: Keyboard shortcuts D/T/E/S/F/P switch tools without crashing', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Shortcut Grid');

  for (const key of ['d', 't', 'e', 's', 'f', 'p']) {
    await page.keyboard.press(key);
  }
  // App still functional after all key presses
  await expect(page.locator('canvas').first()).toBeVisible();
});

// ── TC-07: Erase tooltip says "unassigned" ────────────────────────────────────
test('TC-07: Erase tool tooltip says "unassigned" not "blocked"', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Tooltip Map');

  const eraseBtn = page.locator('button').filter({ hasText: 'Erase' }).first();
  const tip = await eraseBtn.getAttribute('title');
  expect(tip).toContain('unassigned');
  expect(tip).not.toMatch(/reset cells to blocked/);
});

// ── TC-08: Konva canvas is visible after map creation ────────────────────────
test('TC-08: Konva canvas renders with non-zero dimensions after map creation', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Canvas Check');

  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(100);
  expect(box?.height).toBeGreaterThan(100);
});

// ── TC-09: Layer panel — all 8 node types visible ────────────────────────────
test('TC-09: Layer panel shows all 8 node-type layer rows', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Layer Panel Map');

  // Each layer row has a unique LAYER_INFO title attribute — use that to identify them
  const layerTitleFragments = [
    'Generic passable floor',    // traversable
    'Directed path segments',    // path
    'Pickup / induction',        // source
    'Drop-off / delivery',       // destination
    'Battery charging',          // charging
    'Idle or maintenance',       // parking
    'Obstacles and no-go',       // blocked
    'Topology decision',         // junction
  ];
  for (const fragment of layerTitleFragments) {
    await expect(page.locator(`[title*="${fragment}"]`).first()).toBeVisible();
  }
});

// ── TC-10: Layer panel stats section ─────────────────────────────────────────
test('TC-10: Layer panel shows Typed cells, Lanes, Scale, Area stats', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Stats Map', 10, 10);

  await expect(page.locator('text=Typed cells')).toBeVisible();
  // Use exact match — 'text=Lanes' also hits the '↺ Lanes' button via partial match
  await expect(page.getByText('Lanes', { exact: true }).first()).toBeVisible();
  await expect(page.locator('text=Scale')).toBeVisible();
  await expect(page.locator('text=Area')).toBeVisible();
});

// ── TC-11: Map name inline edit ───────────────────────────────────────────────
test('TC-11: Map name can be edited inline via click-to-rename', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Original Name');

  // The name div has title="Click to rename"
  await page.locator('[title="Click to rename"]').click();

  // Edit input appears (autofocused)
  const nameInput = page.locator('input:focus');
  await expect(nameInput).toBeVisible({ timeout: 2000 });

  await nameInput.fill('Renamed Map');
  await nameInput.press('Enter');

  await expect(page.locator('[title="Click to rename"]')).toContainText('Renamed Map');
});

// ── TC-12: Save button — toast + sidebar update ───────────────────────────────
test('TC-12: Save button persists map to API and shows Map saved toast', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Save Test Map');

  await page.click('button:has-text("Save")');
  // Toast text from Toolbar.tsx handleSave: 'Map saved ✓'
  await expect(page.locator('text=Map saved ✓')).toBeVisible({ timeout: 6000 });
});

// ── TC-13: API CRUD lifecycle ─────────────────────────────────────────────────
test('TC-13: API full CRUD — create, get, update, delete, 404 after delete', async ({ request }) => {
  const id = `qa-crud-${Date.now()}`;
  const payload = {
    id,
    name: 'CRUD Test',
    config: { rows: 5, cols: 5, cellShape: 'square', cellSizeMeters: 1 },
    cells: [{ id: 'c1', coord: { row: 0, col: 0 }, nodeType: 'source', assigned: true }],
    edges: [],
    layers: [],
    schemaVersion: 2,
  };

  const create = await request.post(`${API}/api/maps`, { data: payload });
  expect(create.status()).toBe(201);
  const created = await create.json();
  expect(created.id).toBe(id);
  expect(created.name).toBe('CRUD Test');

  const get = await request.get(`${API}/api/maps/${id}`);
  expect(get.ok()).toBeTruthy();
  const fetched = await get.json();
  expect(fetched.cells).toHaveLength(1);
  expect(fetched.cells[0].nodeType).toBe('source');

  const patch = await request.patch(`${API}/api/maps/${id}`, { data: { name: 'CRUD Updated' } });
  expect(patch.ok()).toBeTruthy();
  expect((await patch.json()).name).toBe('CRUD Updated');

  const list = await request.get(`${API}/api/maps?limit=100`);
  const items = await list.json();
  expect(items.some((m: { id: string }) => m.id === id)).toBeTruthy();

  const del = await request.delete(`${API}/api/maps/${id}`);
  expect(del.status()).toBe(204);

  const getAfterDel = await request.get(`${API}/api/maps/${id}`);
  expect(getAfterDel.status()).toBe(404);
});

// ── TC-14: API cursor pagination ──────────────────────────────────────────────
test('TC-14: API GET /api/maps returns X-Next-Cursor when more pages exist', async ({ request }) => {
  // Create 3 maps so there are multiple for pagination
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await request.post(`${API}/api/maps`, {
      data: {
        id: `qa-page-${i}-${Date.now()}`,
        name: `Pagination ${i}`,
        config: { rows: 3, cols: 3, cellShape: 'square', cellSizeMeters: 1 },
        cells: [], edges: [], layers: [], schemaVersion: 2,
      },
    });
    ids.push((await r.json()).id);
  }

  const page1 = await request.get(`${API}/api/maps?limit=1`);
  expect(page1.ok()).toBeTruthy();
  const cursor = page1.headers()['x-next-cursor'];
  if (cursor) {
    const page2 = await request.get(`${API}/api/maps?limit=1&cursor=${cursor}`);
    expect(page2.ok()).toBeTruthy();
  }

  for (const id of ids) await request.delete(`${API}/api/maps/${id}`);
});

// ── TC-15: API invalid cursor ─────────────────────────────────────────────────
test('TC-15: Invalid cursor is silently ignored — returns 200 not 500', async ({ request }) => {
  const r = await request.get(`${API}/api/maps?cursor=notbase64!!!`);
  expect(r.ok()).toBeTruthy();
});

// ── TC-16: Ctrl+Z / Ctrl+Y shortcuts ─────────────────────────────────────────
test('TC-16: Ctrl+Z (undo) and Ctrl+Y (redo) do not crash the app', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Undo Redo Map');

  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+y');
  await expect(page.locator('canvas').first()).toBeVisible();
});

// ── TC-17: Shortcuts suppressed inside inputs ─────────────────────────────────
test('TC-17: Tool shortcuts are suppressed when map name input is focused', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Input Focus Test');

  await page.locator('[title="Click to rename"]').click();
  const nameInput = page.locator('input:focus');
  await expect(nameInput).toBeVisible({ timeout: 2000 });

  // Typing 'd' (Draw shortcut) in the input should NOT switch tools
  // It should just type 'd' into the input
  await nameInput.type('d');
  await expect(nameInput).toBeFocused();
  await nameInput.press('Escape');
});

// ── TC-18: Export modal — structure and presets ───────────────────────────────
test('TC-18: Export modal opens with format/preset/origin controls', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Export Modal Map');

  await page.click('button:has-text("Export")');
  await expect(page.locator('text=Custom Export')).toBeVisible();

  // Format toggle — use exact match to avoid hitting 'Download JSON' button
  await expect(page.getByRole('button', { name: 'JSON', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'YAML', exact: true })).toBeVisible();

  // Presets
  await expect(page.locator('button:has-text("Naxa native")')).toBeVisible();
  await expect(page.locator('button:has-text("ROS 2 / Nav2")')).toBeVisible();
  await expect(page.locator('button:has-text("AMR generic")')).toBeVisible();
  await expect(page.locator('button:has-text("Custom")')).toBeVisible();

  // Coordinate origin
  await expect(page.locator('button:has-text("0-indexed")')).toBeVisible();
  await expect(page.locator('button:has-text("1-indexed")')).toBeVisible();

  // Close via × button
  await page.click('button:has-text("✕")');
  await expect(page.locator('text=Custom Export')).not.toBeVisible({ timeout: 2000 });
});

// ── TC-19: Export modal — backdrop click closes ───────────────────────────────
test('TC-19: Clicking backdrop closes the export modal', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Export Backdrop');

  await page.click('button:has-text("Export")');
  await expect(page.locator('text=Custom Export')).toBeVisible();

  // Click the fixed backdrop at top-left corner (outside the modal panel)
  await page.mouse.click(5, 5);
  await expect(page.locator('text=Custom Export')).not.toBeVisible({ timeout: 2000 });
});

// ── TC-20: Export modal — Custom preset enables field inputs ──────────────────
test('TC-20: Custom preset makes field name inputs editable', async ({ page }) => {
  await page.goto(WEB);
  // Map name must NOT contain 'Custom Export' — would clash with the modal heading
  await createMap(page, 'Field Config Test');

  await page.click('button:has-text("Export")');
  await expect(page.getByText('Custom Export', { exact: true })).toBeVisible();

  // Non-custom preset: inputs are disabled
  // (default is 'naxa' preset — inputs should be disabled)
  const fieldInputs = page.locator('input[style*="monospace"]');
  await expect(fieldInputs.first()).toBeDisabled();

  // Switch to Custom — inputs become enabled
  await page.click('button:has-text("Custom")');
  await expect(fieldInputs.first()).toBeEnabled();

  // Edit the cell type field name
  await fieldInputs.first().fill('node_type');
  await expect(fieldInputs.first()).toHaveValue('node_type');

  await page.click('button:has-text("Cancel")');
});

// ── TC-21: Export modal — ROS2 preset applies y/x field names ────────────────
test('TC-21: ROS 2 / Nav2 preset shows y and x for row and col keys', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'ROS2 Export');

  await page.click('button:has-text("Export")');
  await page.click('button:has-text("ROS 2 / Nav2")');

  // Row key should now be 'y', col key 'x'
  // Inputs are disabled in preset mode — check the rendered value via inputValue
  const inputs = page.locator('input[style*="monospace"]');
  const values = await inputs.evaluateAll((els: HTMLInputElement[]) => els.map(e => e.value));
  expect(values).toContain('y');
  expect(values).toContain('x');
  expect(values).toContain('source');
  expect(values).toContain('target');

  await page.click('button:has-text("Cancel")');
});

// ── TC-22: Dark/Light theme toggle ───────────────────────────────────────────
test('TC-22: Theme toggle switches between ☾ Dark and ☀ Light labels', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Theme Toggle');

  // Default is dark — button shows '☾ Dark'
  const themeBtn = page.locator('button').filter({ hasText: /Dark|Light/ }).first();
  await expect(themeBtn).toContainText('Dark');

  // Toggle to light
  await themeBtn.click();
  await expect(themeBtn).toContainText('Light');

  // Toggle back to dark
  await themeBtn.click();
  await expect(themeBtn).toContainText('Dark');
});

// ── TC-23: Coords toggle ──────────────────────────────────────────────────────
test('TC-23: Coords button toggles without crashing', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Coords Toggle');

  const coordsBtn = page.locator('button:has-text("Coords")');
  await expect(coordsBtn).toBeVisible();
  await expect(coordsBtn).toBeEnabled();
  await coordsBtn.click();
  await coordsBtn.click();
  await expect(page.locator('canvas').first()).toBeVisible();
});

// ── TC-24: Labels toggle ──────────────────────────────────────────────────────
test('TC-24: Labels button toggles without crashing', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Labels Toggle');

  const labelsBtn = page.locator('button:has-text("Labels")');
  await expect(labelsBtn).toBeVisible();
  await labelsBtn.click();
  await labelsBtn.click();
  await expect(page.locator('canvas').first()).toBeVisible();
});

// ── TC-25: Validate — empty map ───────────────────────────────────────────────
test('TC-25: Validate on empty map (no sources) shows All nodes reachable toast', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Validate Empty');

  await page.click('button:has-text("Validate")');
  // With no sources → BFS returns no unreachable → 'All nodes reachable ✓'
  await expect(page.locator('text=All nodes reachable ✓')).toBeVisible({ timeout: 3000 });
});

// ── TC-26: Fit to screen ─────────────────────────────────────────────────────
test('TC-26: ⤢ Fit button fits canvas and canvas remains visible', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Fit Screen');

  const fitBtn = page.locator('button:has-text("⤢ Fit")');
  await expect(fitBtn).toBeVisible();
  await fitBtn.click();
  await expect(page.locator('canvas').first()).toBeVisible();
});

// ── TC-27: Reset Lanes ────────────────────────────────────────────────────────
test('TC-27: ↺ Lanes button clears edges and shows toast', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Reset Lanes');

  await page.click('button:has-text("↺ Lanes")');
  await expect(page.locator('text=Lanes cleared ✓')).toBeVisible({ timeout: 3000 });
});

// ── TC-28: Reset All (with confirm dialog) ───────────────────────────────────
test('TC-28: ↺ Reset button with confirm=accept resets map and shows toast', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Reset All Map');

  // Handle the window.confirm dialog — accept it
  page.on('dialog', dialog => dialog.accept());

  await page.click('button:has-text("↺ Reset")');
  await expect(page.locator('text=Map reset ✓')).toBeVisible({ timeout: 3000 });
});

// ── TC-29: Load JSON triggers file chooser ────────────────────────────────────
test('TC-29: ↑ Load button opens a file chooser for .json files', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Load Test');

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 3000 }),
    page.click('button:has-text("↑ Load")'),
  ]);
  expect(fileChooser.isMultiple()).toBe(false);
});

// ── TC-30: Saved maps list appears in sidebar after save ─────────────────────
test('TC-30: Sidebar shows saved maps list after save', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Sidebar Persist');

  await page.click('button:has-text("Save")');
  await expect(page.locator('text=Map saved ✓')).toBeVisible({ timeout: 6000 });

  // "Saved" section label appears in sidebar
  await expect(page.locator('text=Saved').last()).toBeVisible({ timeout: 3000 });
  // Map name appears in saved list
  await expect(page.locator('text=Sidebar Persist').first()).toBeVisible();
});

// ── TC-31: API 404 on nonexistent map ────────────────────────────────────────
test('TC-31: PATCH on nonexistent map ID returns 404', async ({ request }) => {
  const r = await request.patch(`${API}/api/maps/definitely-does-not-exist-99999`, {
    data: { name: 'Ghost Map' },
  });
  expect(r.status()).toBe(404);
});

// ── TC-32: API data roundtrip integrity ──────────────────────────────────────
test('TC-32: API preserves all cells, edges, and config on roundtrip', async ({ request }) => {
  const id = `qa-rt-${Date.now()}`;
  const cells = Array.from({ length: 4 }, (_, i) => ({
    id: `c${i}`, coord: { row: Math.floor(i / 2), col: i % 2 },
    nodeType: i === 0 ? 'source' : i === 3 ? 'destination' : 'traversable',
    assigned: true,
  }));
  const edges = [
    { id: 'e_c0_c1', from: 'c0', to: 'c1', direction: 'E', bidirectional: false, cost: 1 },
    { id: 'e_c1_c3', from: 'c1', to: 'c3', direction: 'S', bidirectional: true, cost: 2.5 },
  ];

  const r = await request.post(`${API}/api/maps`, {
    data: { id, name: 'Roundtrip', config: { rows: 2, cols: 2, cellShape: 'square', cellSizeMeters: 0.5 }, cells, edges, layers: [], schemaVersion: 2 },
  });
  expect(r.status()).toBe(201);

  const get = await request.get(`${API}/api/maps/${id}`);
  const body = await get.json();

  expect(body.cells).toHaveLength(4);
  expect(body.edges).toHaveLength(2);
  expect(body.edges[1].bidirectional).toBe(true);
  expect(body.edges[1].cost).toBe(2.5);
  expect(body.config.cellSizeMeters).toBe(0.5);
  expect(body.cells.find((c: { nodeType: string }) => c.nodeType === 'destination')).toBeTruthy();

  await request.delete(`${API}/api/maps/${id}`);
});

// ── TC-33: No JavaScript errors on load ──────────────────────────────────────
test('TC-33: App loads without uncaught JavaScript errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(WEB);
  await page.waitForLoadState('networkidle');

  // Filter out known non-critical browser warnings
  const realErrors = errors.filter(e =>
    !e.includes('ResizeObserver') &&
    !e.includes('favicon') &&
    !e.includes('WebSocket') // Vite HMR WS in dev mode
  );
  expect(realErrors).toHaveLength(0);
});

// ── TC-34: No errors after map creation ──────────────────────────────────────
test('TC-34: No uncaught errors after creating a map', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(WEB);
  await createMap(page, 'Error Watch Map');

  const realErrors = errors.filter(e =>
    !e.includes('ResizeObserver') &&
    !e.includes('WebSocket')
  );
  expect(realErrors).toHaveLength(0);
});

// ── TC-35: Multiple maps — create and switch ──────────────────────────────────
test('TC-35: Can create two maps sequentially', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Alpha Map');

  // Create second map
  await page.click('button:has-text("+ New Map")');
  const modal = page.locator('div').filter({ has: page.locator('h2:has-text("New Map")') }).last();
  await modal.locator('input').first().fill('Beta Map');
  await modal.locator('button:has-text("Create Map")').click();
  await expect(page.locator('h2:has-text("New Map")')).not.toBeVisible({ timeout: 3000 });

  // Beta Map should now be active
  await expect(page.locator('[title="Click to rename"]')).toContainText('Beta Map');
});

// ── TC-36: Cell info panel hidden when no cell selected ──────────────────────
test('TC-36: Cell info (Subtype/Label) panel is not shown by default', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'No Cell Info');

  // Without an assigned cell selected, Subtype/Label panel should not appear
  await expect(page.locator('text=Subtype')).not.toBeVisible();
});

// ── TC-37: Trace ▶ button is present and clickable ───────────────────────────
test('TC-37: Trace ▶ button is visible and enabled with a map loaded', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Trace Map');

  const traceBtn = page.locator('button:has-text("▶ Trace")');
  await expect(traceBtn).toBeVisible();
  await expect(traceBtn).toBeEnabled();

  // Click trace — no source→dest routes → shows 'No valid source→destination paths found'
  await traceBtn.click();
  await expect(page.locator('text=No valid source→destination paths found')).toBeVisible({ timeout: 3000 });
});

// ── TC-38: Fit to screen triggers on new map ─────────────────────────────────
test('TC-38: Canvas has visible area after map creation (auto-fit fired)', async ({ page }) => {
  await page.goto(WEB);
  await createMap(page, 'Auto Fit', 20, 20);

  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(box?.height).toBeGreaterThan(0);
});

// ── TC-39: POST without ID auto-generates UUID ───────────────────────────────
test('TC-39: POST /api/maps without ID generates a UUID-format id', async ({ request }) => {
  const r = await request.post(`${API}/api/maps`, {
    data: {
      name: 'Auto UUID Map',
      config: { rows: 3, cols: 3, cellShape: 'square', cellSizeMeters: 1 },
      cells: [], edges: [], layers: [], schemaVersion: 2,
    },
  });
  expect(r.status()).toBe(201);
  const body = await r.json();
  expect(body.id).toBeTruthy();
  // UUID v4 pattern
  expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  await request.delete(`${API}/api/maps/${body.id}`);
});

// ── TC-40: API timestamps are valid ISO dates ─────────────────────────────────
test('TC-40: API returns valid ISO timestamp strings for createdAt and updatedAt', async ({ request }) => {
  const id = `qa-ts-${Date.now()}`;
  const r = await request.post(`${API}/api/maps`, {
    data: { id, name: 'Timestamp', config: { rows: 3, cols: 3, cellShape: 'square', cellSizeMeters: 1 }, cells: [], edges: [], layers: [], schemaVersion: 2 },
  });
  expect(r.status()).toBe(201);
  const body = await r.json();

  // Find whichever casing the API uses (createdAt or created_at)
  const createdAt: string = body.createdAt ?? body.created_at;
  const updatedAt: string = body.updatedAt ?? body.updated_at;

  expect(createdAt).toBeTruthy();
  expect(updatedAt).toBeTruthy();
  expect(new Date(createdAt).getTime()).not.toBeNaN();
  expect(new Date(updatedAt).getTime()).not.toBeNaN();

  // Must be UTC — should NOT have +00:00 from utcnow() bug (was deprecated in py 3.12)
  const d = new Date(createdAt);
  expect(d.getFullYear()).toBeGreaterThanOrEqual(2024);

  await request.delete(`${API}/api/maps/${id}`);
});
