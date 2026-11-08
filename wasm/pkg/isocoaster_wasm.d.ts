/* tslint:disable */
/* eslint-disable */

/**
 * The main game struct exposed to JavaScript
 */
export class Game {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Get current cash balance
     */
    get_cash(): bigint;
    /**
     * Get current tool name
     */
    get_current_tool(): string;
    /**
     * Get grid size
     */
    get_grid_size(): number;
    /**
     * Get guest count
     */
    get_guest_count(): number;
    /**
     * Get park rating
     */
    get_park_rating(): number;
    /**
     * Get current game speed
     */
    get_speed(): number;
    /**
     * Get current time as string (e.g., "Year 1, March 15, 10:30")
     */
    get_time_string(): string;
    /**
     * Handle mouse click at screen coordinates
     */
    handle_click(screen_x: number, screen_y: number): void;
    /**
     * Handle mouse down for dragging
     */
    handle_mouse_down(x: number, y: number): void;
    /**
     * Handle mouse move for panning
     */
    handle_mouse_move(x: number, y: number): void;
    /**
     * Handle mouse up
     */
    handle_mouse_up(x: number, y: number): void;
    /**
     * Handle mouse wheel for zooming
     */
    handle_wheel(delta_y: number, mouse_x: number, mouse_y: number): void;
    /**
     * Load a sprite sheet image
     */
    load_sprite_sheet(id: string, image: HTMLImageElement, dimensions: any): void;
    /**
     * Load the water texture
     */
    load_water_texture(image: HTMLImageElement): void;
    /**
     * Create a new game instance
     */
    constructor(canvas: HTMLCanvasElement, grid_size: number, pixel_ratio: number);
    /**
     * Render the current game state
     */
    render(): void;
    /**
     * Resize canvas
     */
    resize(width: number, height: number, pixel_ratio: number): void;
    /**
     * Set game speed (0 = paused, 1 = normal, 2 = fast, 3 = fastest)
     */
    set_speed(speed: number): void;
    /**
     * Set the current tool
     */
    set_tool(tool: string): void;
    /**
     * Advance game simulation by one tick
     */
    tick(): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_game_free: (a: number, b: number) => void;
    readonly game_get_cash: (a: number) => bigint;
    readonly game_get_current_tool: (a: number) => [number, number];
    readonly game_get_grid_size: (a: number) => number;
    readonly game_get_guest_count: (a: number) => number;
    readonly game_get_park_rating: (a: number) => number;
    readonly game_get_speed: (a: number) => number;
    readonly game_get_time_string: (a: number) => [number, number];
    readonly game_handle_click: (a: number, b: number, c: number) => void;
    readonly game_handle_mouse_down: (a: number, b: number, c: number) => void;
    readonly game_handle_mouse_move: (a: number, b: number, c: number) => void;
    readonly game_handle_mouse_up: (a: number, b: number, c: number) => void;
    readonly game_handle_wheel: (a: number, b: number, c: number, d: number) => void;
    readonly game_load_sprite_sheet: (a: number, b: number, c: number, d: any, e: any) => [number, number];
    readonly game_load_water_texture: (a: number, b: any) => [number, number];
    readonly game_new: (a: any, b: number, c: number) => [number, number, number];
    readonly game_render: (a: number) => [number, number];
    readonly game_resize: (a: number, b: number, c: number, d: number) => void;
    readonly game_set_speed: (a: number, b: number) => void;
    readonly game_set_tool: (a: number, b: number, c: number) => void;
    readonly game_tick: (a: number) => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
