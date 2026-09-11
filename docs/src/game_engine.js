import { GRID_SIZE, canMove, initialBoard, moveWithoutSpawn, spawnRandomTile } from "./game_rules.js";
import { WeaponType, canAttack, columnLevel, columnPower, fireIntervalSeconds, projectileSpeed, selectTarget, weaponType } from "./column_combat_rules.js";

const MAX_HP = 1931;
const INITIAL_ENEMY_HP = 24;
const ENEMIES_PER_WAVE = 7;
const ENEMY_SPAWN_SECONDS = 1.30;
const BOSS_EVERY_WAVES = 5;
const BOSS_WARNING_SECONDS = 5;
const BOSS_SPEED_RATIO = 0.55;
const BOSS_HP_RATIO = 12;
const SAVE_SCHEMA = 1;

export class GameEngine {
  constructor(random = Math.random) {
    this.random = random;
    this.reset();
  }

  reset() {
    this.enemyId = 1;
    this.projectileId = 1;
    this.spawnTimer = 0;
    this.enemiesSpawnedThisWave = 0;
    this.lastBossWave = 0;
    this.pendingBoss = false;
    this.state = {
      schema: SAVE_SCHEMA,
      board: initialBoard(this.random),
      score: 0,
      currentHp: MAX_HP,
      maxHp: MAX_HP,
      wave: 1,
      enemies: [],
      projectiles: [],
      cooldowns: [0, 0, 0, 0],
      bossWarning: null,
      gameOverReason: null,
      mergeBurst: 0,
      elapsedSeconds: 0,
    };
    return this.snapshot();
  }

  snapshot() {
    return structuredClone(this.state);
  }

  restore(saved) {
    if (!saved || typeof saved !== "object") return false;
    const state = saved.state ?? saved;
    if (!Array.isArray(state.board) || state.board.length !== 16) return false;
    if (!Array.isArray(state.enemies) || !Array.isArray(state.projectiles)) return false;
    this.state = {
      schema: SAVE_SCHEMA,
      board: state.board.map((v) => Number(v) || 0),
      score: Math.max(0, Number(state.score) || 0),
      currentHp: Math.max(0, Number(state.currentHp) || MAX_HP),
      maxHp: Math.max(1, Number(state.maxHp) || MAX_HP),
      wave: Math.max(1, Number(state.wave) || 1),
      enemies: state.enemies.map((e) => ({ ...e })),
      projectiles: state.projectiles.map((p) => ({ ...p })),
      cooldowns: Array.isArray(state.cooldowns) ? state.cooldowns.slice(0, 4).map((v) => Math.max(0, Number(v) || 0)) : [0,0,0,0],
      bossWarning: state.bossWarning ? { remainingSeconds: Math.max(0, Number(state.bossWarning.remainingSeconds) || 0) } : null,
      gameOverReason: state.gameOverReason === "BOARD_STUCK" || state.gameOverReason === "HP_ZERO" ? state.gameOverReason : null,
      mergeBurst: 0,
      elapsedSeconds: Math.max(0, Number(state.elapsedSeconds) || 0),
    };
    while (this.state.cooldowns.length < 4) this.state.cooldowns.push(0);
    this.enemyId = Math.max(1, ...this.state.enemies.map((e) => Number(e.id) || 0)) + 1;
    this.projectileId = Math.max(1, ...this.state.projectiles.map((p) => Number(p.id) || 0)) + 1;
    this.spawnTimer = Math.max(0, Number(saved.spawnTimer) || 0);
    this.enemiesSpawnedThisWave = Math.max(0, Math.min(ENEMIES_PER_WAVE - 1, Number(saved.enemiesSpawnedThisWave) || 0));
    this.lastBossWave = Math.max(0, Number(saved.lastBossWave) || 0);
    this.pendingBoss = Boolean(saved.pendingBoss ?? this.state.bossWarning);
    return true;
  }

  serialize() {
    return {
      schema: SAVE_SCHEMA,
      state: this.snapshot(),
      spawnTimer: this.spawnTimer,
      enemiesSpawnedThisWave: this.enemiesSpawnedThisWave,
      lastBossWave: this.lastBossWave,
      pendingBoss: this.pendingBoss,
    };
  }

  move(direction) {
    if (this.state.gameOverReason) return { changed: false, scoreChanged: false, gameOver: true };
    const result = moveWithoutSpawn(this.state.board, direction);
    if (!result.moved) return { changed: false, scoreChanged: false, gameOver: false };
    const board = spawnRandomTile(result.board, this.random);
    const gained = result.createdValues.reduce((sum, value) => sum + value, 0);
    this.state.board = board;
    this.state.score += gained;
    this.state.mergeBurst = gained;
    if (!canMove(board)) this.state.gameOverReason = "BOARD_STUCK";
    return { changed: true, scoreChanged: gained > 0, gameOver: Boolean(this.state.gameOverReason) };
  }

  tick(deltaSeconds) {
    if (this.state.gameOverReason) return { scoreChanged: false, waveChanged: false, gameOver: true };
    const delta = Math.max(0, Math.min(0.05, deltaSeconds));
    this.state.elapsedSeconds += delta;
    let scoreChanged = false;
    let waveChanged = false;

    for (const enemy of this.state.enemies) enemy.progress += enemy.speed * delta;
    const leaked = this.state.enemies.filter((enemy) => enemy.progress >= 1);
    if (leaked.length) {
      const leakedIds = new Set(leaked.map((enemy) => enemy.id));
      const damage = leaked.reduce((sum, enemy) => sum + Math.max(1, Math.trunc(enemy.hp)), 0);
      this.state.currentHp = Math.max(0, this.state.currentHp - damage);
      this.state.enemies = this.state.enemies.filter((enemy) => !leakedIds.has(enemy.id));
    }
    if (this.state.currentHp <= 0) {
      this.state.gameOverReason = "HP_ZERO";
      return { scoreChanged, waveChanged, gameOver: true };
    }

    if (this.state.bossWarning) {
      this.state.bossWarning.remainingSeconds -= delta;
      if (this.state.bossWarning.remainingSeconds <= 0) {
        this.state.enemies.push(this.createBoss(this.enemyId++, this.state.wave));
        this.lastBossWave = this.state.wave;
        this.pendingBoss = false;
        this.state.bossWarning = null;
      }
    }

    this.spawnTimer += delta;
    const spawnInterval = Math.max(0.48, ENEMY_SPAWN_SECONDS - (this.state.wave - 1) * 0.045);
    if (this.spawnTimer >= spawnInterval) {
      this.spawnTimer = 0;
      this.state.enemies.push(this.createNormalEnemy(this.enemyId++, this.state.wave));
      this.enemiesSpawnedThisWave += 1;
      if (this.enemiesSpawnedThisWave >= ENEMIES_PER_WAVE) {
        this.enemiesSpawnedThisWave = 0;
        this.state.wave += 1;
        waveChanged = true;
        if (this.state.wave % BOSS_EVERY_WAVES === 0 && this.lastBossWave !== this.state.wave) {
          this.pendingBoss = true;
          this.state.bossWarning = { remainingSeconds: BOSS_WARNING_SECONDS };
        }
      }
    }

    this.state.cooldowns = this.state.cooldowns.map((value) => Math.max(0, value - delta));
    for (let column = 0; column < GRID_SIZE; column += 1) {
      const power = columnPower(this.state.board, column);
      if (power <= 0 || this.state.cooldowns[column] > 0) continue;
      const target = selectTarget(column, this.state.enemies);
      if (!target) continue;
      const type = weaponType(columnLevel(this.state.board, column));
      const source = this.turretPosition(column);
      this.state.projectiles.push({
        id: this.projectileId++, sourceColumn: column, targetEnemyId: target.id,
        damage: power, x: source.x, y: source.y, speed: projectileSpeed(type), weaponType: type,
      });
      this.state.cooldowns[column] = fireIntervalSeconds(type);
    }

    const hits = [];
    const moving = [];
    for (const projectile of this.state.projectiles) {
      const existing = this.state.enemies.find((enemy) => enemy.id === projectile.targetEnemyId);
      const target = existing ?? selectTarget(projectile.sourceColumn, this.state.enemies);
      if (!target) continue;
      const tx = this.enemyX(target);
      const ty = target.progress;
      const dx = tx - projectile.x;
      const dy = ty - projectile.y;
      const distance = Math.max(0.0001, Math.hypot(dx, dy));
      const moveDistance = projectile.speed * delta;
      const hitRadius = target.enemyType === "BOSS" ? 0.065 : 0.035;
      if (distance <= moveDistance + hitRadius) {
        hits.push({ ...projectile, targetEnemyId: target.id });
      } else {
        moving.push({ ...projectile, targetEnemyId: target.id, x: projectile.x + dx / distance * moveDistance, y: projectile.y + dy / distance * moveDistance });
      }
    }
    this.state.projectiles = moving;

    if (hits.length) {
      const damageByEnemyId = new Map();
      const addDamage = (id, damage) => damageByEnemyId.set(id, (damageByEnemyId.get(id) ?? 0) + damage);
      for (const projectile of hits) {
        const target = this.state.enemies.find((enemy) => enemy.id === projectile.targetEnemyId);
        if (!target) continue;
        if ([WeaponType.NORMAL, WeaponType.RAPID, WeaponType.MACHINE_GUN].includes(projectile.weaponType)) {
          addDamage(target.id, projectile.damage);
        } else if (projectile.weaponType === WeaponType.PIERCING) {
          addDamage(target.id, projectile.damage);
          this.state.enemies
            .filter((enemy) => enemy.id !== target.id && canAttack(projectile.sourceColumn, enemy))
            .sort((a, b) => b.progress - a.progress).slice(0, 2)
            .forEach((enemy) => addDamage(enemy.id, Math.max(1, Math.trunc(projectile.damage * 0.70))));
        } else if (projectile.weaponType === WeaponType.EXPLOSIVE) {
          addDamage(target.id, projectile.damage);
          this.state.enemies
            .filter((enemy) => enemy.id !== target.id && canAttack(projectile.sourceColumn, enemy) && Math.abs(enemy.progress - target.progress) <= 0.14)
            .forEach((enemy) => addDamage(enemy.id, Math.max(1, Math.trunc(projectile.damage * 0.60))));
        } else if (projectile.weaponType === WeaponType.LASER) {
          this.state.enemies.filter((enemy) => canAttack(projectile.sourceColumn, enemy)).forEach((enemy) => addDamage(enemy.id, projectile.damage));
        }
      }
      const survivors = [];
      for (const enemy of this.state.enemies) {
        const damage = damageByEnemyId.get(enemy.id) ?? 0;
        if (damage <= 0) { survivors.push(enemy); continue; }
        const nextHp = enemy.hp - damage;
        if (nextHp <= 0) {
          this.state.score += Math.trunc(enemy.maxHp);
          scoreChanged = true;
        } else survivors.push({ ...enemy, hp: nextHp });
      }
      this.state.enemies = survivors;
    }

    return { scoreChanged, waveChanged, gameOver: Boolean(this.state.gameOverReason) };
  }

  createNormalEnemy(id, wave) {
    const lane = Math.floor(this.random() * GRID_SIZE);
    const maxHp = INITIAL_ENEMY_HP + wave * 7 + Math.floor(this.random() * 9);
    return { id, enemyType: "NORMAL", lane, progress: -0.05, speed: 0.075 + this.random() * 0.035 + wave * 0.003, hp: maxHp, maxHp };
  }

  createBoss(id, wave) {
    const hp = (INITIAL_ENEMY_HP + wave * 7) * BOSS_HP_RATIO;
    return { id, enemyType: "BOSS", lane: -1, progress: -0.08, speed: (0.075 + wave * 0.003) * BOSS_SPEED_RATIO, hp, maxHp: hp };
  }

  turretPosition(column) { return { x: (column + 0.5) / GRID_SIZE, y: 0.955 }; }
  enemyX(enemy) { return enemy.enemyType === "BOSS" ? 0.5 : (enemy.lane + 0.5) / GRID_SIZE; }
}

export const CURRENT_MAX_HP = MAX_HP;
