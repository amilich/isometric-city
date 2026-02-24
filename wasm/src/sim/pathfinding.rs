//! Pathfinding algorithms

use std::collections::{VecDeque, HashSet};
use crate::game::tile::Tile;

/// Find path from start to target using BFS
/// Only traverses path/queue tiles
pub fn find_path(
    grid: &[Vec<Tile>],
    start: (i32, i32),
    target: (i32, i32),
    max_steps: usize,
) -> Vec<(i32, i32)> {
    let grid_size = grid.len() as i32;
    
    if start == target {
        return vec![target];
    }
    
    // BFS
    let mut visited: HashSet<(i32, i32)> = HashSet::new();
    let mut queue: VecDeque<((i32, i32), Vec<(i32, i32)>)> = VecDeque::new();
    
    queue.push_back((start, Vec::new()));
    visited.insert(start);
    
    let directions = [(1, 0), (-1, 0), (0, 1), (0, -1)];
    
    while let Some((current, path)) = queue.pop_front() {
        if path.len() >= max_steps {
            continue;
        }
        
        if current == target {
            let mut result = path;
            result.push(target);
            return result;
        }
        
        for (dx, dy) in &directions {
            let nx = current.0 + dx;
            let ny = current.1 + dy;
            
            if nx < 0 || ny < 0 || nx >= grid_size || ny >= grid_size {
                continue;
            }
            
            if visited.contains(&(nx, ny)) {
                continue;
            }
            
            let tile = &grid[ny as usize][nx as usize];
            
            // Can only walk on path/queue tiles
            if !tile.is_walkable() {
                continue;
            }
            
            visited.insert((nx, ny));
            
            let mut new_path = path.clone();
            new_path.push(current);
            queue.push_back(((nx, ny), new_path));
        }
    }
    
    // No path found
    Vec::new()
}

/// Find nearest tile matching predicate
pub fn find_nearest<F>(
    grid: &[Vec<Tile>],
    start: (i32, i32),
    max_distance: usize,
    predicate: F,
) -> Option<(i32, i32)>
where
    F: Fn(&Tile) -> bool,
{
    let grid_size = grid.len() as i32;
    
    // BFS
    let mut visited: HashSet<(i32, i32)> = HashSet::new();
    let mut queue: VecDeque<((i32, i32), usize)> = VecDeque::new();
    
    queue.push_back((start, 0));
    visited.insert(start);
    
    let directions = [(1, 0), (-1, 0), (0, 1), (0, -1)];
    
    while let Some((current, distance)) = queue.pop_front() {
        if distance >= max_distance {
            continue;
        }
        
        let tile = &grid[current.1 as usize][current.0 as usize];
        
        if predicate(tile) && current != start {
            return Some(current);
        }
        
        for (dx, dy) in &directions {
            let nx = current.0 + dx;
            let ny = current.1 + dy;
            
            if nx < 0 || ny < 0 || nx >= grid_size || ny >= grid_size {
                continue;
            }
            
            if visited.contains(&(nx, ny)) {
                continue;
            }
            
            visited.insert((nx, ny));
            queue.push_back(((nx, ny), distance + 1));
        }
    }
    
    None
}

/// Find path to any tile adjacent to target building
pub fn find_path_to_building(
    grid: &[Vec<Tile>],
    start: (i32, i32),
    building_pos: (i32, i32),
    max_steps: usize,
) -> Vec<(i32, i32)> {
    let grid_size = grid.len() as i32;
    let directions = [(1, 0), (-1, 0), (0, 1), (0, -1)];
    
    // Find adjacent walkable tiles to building
    for (dx, dy) in &directions {
        let adj_x = building_pos.0 + dx;
        let adj_y = building_pos.1 + dy;
        
        if adj_x < 0 || adj_y < 0 || adj_x >= grid_size || adj_y >= grid_size {
            continue;
        }
        
        let tile = &grid[adj_y as usize][adj_x as usize];
        
        if tile.is_walkable() {
            let path = find_path(grid, start, (adj_x, adj_y), max_steps);
            if !path.is_empty() {
                return path;
            }
        }
    }
    
    Vec::new()
}
