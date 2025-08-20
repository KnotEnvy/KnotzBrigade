window.addEventListener('load', function(){
    //canvas setup
    const canvas = document.getElementById('canvas1');
    const ctx = canvas.getContext('2d');
    canvas.width = 1000;
    canvas.height = 500;

    class InputHandler {
        constructor(game){
            this.game = game;
            window.addEventListener('keydown', e => {
                if ((   (e.key === 'ArrowUp') ||
                        (e.key === 'ArrowDown')
                ) && this.game.keys.indexOf(e.key) === -1){
                    this.game.keys.push(e.key);
                } else if ( e.key === ' '){
                    this.game.currentState.handleInput(e.key);
                } else if ( e.key === 'd'){
                    this.game.debug = !this.game.debug;
                } else if ( e.key === 'Enter') {
                    this.game.currentState.handleInput(e.key);
                }
            });
            window.addEventListener('keyup', e =>{
                if (this.game.keys.indexOf(e.key) > -1){
                    this.game.keys.splice(this.game.keys.indexOf(e.key), 1);
                }
            });
        }
    }

    // State Management
    const states = {
        MAIN_MENU: 0,
        PLAYING: 1,
        GAME_OVER: 2,
    }

    class State {
        constructor(state, game){
            this.state = state;
            this.game = game;
        }
    }

    class MainMenuState extends State {
        constructor(game){
            super('MAIN_MENU', game);
        }
        enter(){
            this.game.player.x = this.game.width * 0.5 - this.game.player.width * 0.5;
            this.game.player.y = this.game.height * 0.5 - this.game.player.height * 0.5 + 80;
            this.game.player.projectiles = [];
        }
        handleInput(input){
            if (input === 'Enter'){
                this.game.setState(states.PLAYING);
            }
        }
        update(deltaTime){
            this.game.background.update();
            this.game.background.layer4.update();
            this.game.player.update(deltaTime);
        }
        draw(context){
            this.game.background.draw(context);
            this.game.background.layer4.draw(context);
            this.game.player.draw(context);

            context.save();
            context.font = '70px ' + this.game.ui.fontFamily;
            context.textAlign = 'center';
            context.fillStyle = 'white';
            context.shadowOffsetX = 3;
            context.shadowOffsetY = 3;
            context.shadowColor = 'black';
            context.fillText('KnotzBrigade', this.game.width * 0.5, this.game.height * 0.5 - 50);
            context.font = '25px ' + this.game.ui.fontFamily;
            context.fillText('Use Arrow Keys to Move, Spacebar to Shoot', this.game.width * 0.5, this.game.height * 0.5);
            context.fillText('Press Enter to start!', this.game.width * 0.5, this.game.height * 0.5 + 40);
            context.restore();
        }
    }

    class PlayingState extends State {
        constructor(game){
            super('PLAYING', game);
        }
        enter(){
            this.game.player.x = 20;
            this.game.player.y = 100;
            this.game.player.health = this.game.player.maxHealth;
            this.game.player.frameY = 0;
            this.game.player.powerUp = false;
            this.game.enemies = [];
            this.game.particles = [];
            this.game.explosions = [];
            this.game.ammo = 20;
            this.game.score = 0;
            this.game.gameTime = 0;
            this.game.stats.reset(); // Reset stats for the new game
            this.game.sound.playBackgroundSound();
        }
        handleInput(input){
            if (input === ' '){
                this.game.player.shootTop();
            }
        }
        update(deltaTime){
            if (this.game.player.health <= 0) {
                this.game.setState(states.GAME_OVER);
                return;
            }

            this.game.gameTime += deltaTime;
            if (this.game.gameTime > this.game.timeLimit) {
                this.game.setState(states.GAME_OVER);
            }
            this.game.background.update();
            this.game.background.layer4.update();
            this.game.player.update(deltaTime);
            if (this.game.ammoTimer > this.game.ammoInterval){
                if (this.game.ammo < this.game.maxAmmo) this.game.ammo++;
                this.game.ammoTimer = 0;
            } else {
                this.game.ammoTimer += deltaTime;
            }
            
            this.game.shield.update(deltaTime);
            
            this.game.particles.forEach(particle => particle.update());
            this.game.particles = this.game.particles.filter(particle => !particle.markedForDeletion);
            
            this.game.explosions.forEach(explosion => explosion.update(deltaTime));
            this.game.explosions = this.game.explosions.filter(explosion => !explosion.markedForDeletion);
            
            this.game.enemies.forEach(enemy => {
                enemy.update(deltaTime);
                if (this.game.checkCollision(this.game.player, enemy)){
                    enemy.markedForDeletion = true;
                    this.game.addExplosion(enemy);
                    this.game.sound.hit();
                    this.game.shield.reset();
                    this.game.camera.shake(150, 10);
                    for (let i = 0; i < enemy.score; i++){
                        this.game.particles.push(new Particle(this.game, enemy.x + enemy.width * 0.5, enemy.y + enemy.height * 0.5));
                    }
                    if (enemy.type === 'lucky') this.game.player.enterPowerUp();
                    else {
                        this.game.player.health--;
                        this.game.stats.damageTaken++; // Track damage
                    }
                }
                this.game.player.projectiles.forEach(projectile => {
                    if (this.game.checkCollision(projectile, enemy)){
                        enemy.lives--;
                        enemy.hit();
                        projectile.markedForDeletion = true;
                        this.game.stats.projectilesHit++; // Track hits
                        this.game.particles.push(new Particle(this.game, enemy.x + enemy.width * 0.5, enemy.y + enemy.height * 0.5))
                        if (enemy.lives <=0){
                            for (let i = 0; i < enemy.score; i++){
                                this.game.particles.push(new Particle(this.game, enemy.x + enemy.width * 0.5, enemy.y + enemy.height * 0.5))
                            }
                            enemy.markedForDeletion = true;
                            this.game.addExplosion(enemy)
                            this.game.sound.explosion();
                            this.game.stats.enemiesDefeated++; // Track kills
                            if (enemy.type === 'moon') this.game.player.enterPowerUp();
                            if (enemy.type === 'hive'){
                                for (let i = 0; i < 5; i++){
                                    this.game.enemies.push(new Drone(this.game, enemy.x + Math.random() * enemy.width, enemy.y + Math.random() * enemy.height * 0.5));
                                }
                            }
                            this.game.score += enemy.score;
                        }
                    }
                })
            });
            this.game.enemies = this.game.enemies.filter(enemy => !enemy.markedForDeletion);
            if (this.game.enemyTimer > this.game.enemyInterval){
                this.game.addEnemy();
                this.game.enemyTimer = 0;

            } else {
                this.game.enemyTimer += deltaTime;
            }
        }
        draw(context){
            this.game.background.draw(context);
            this.game.player.draw(context);
            this.game.shield.draw(context);
            this.game.particles.forEach(particle => particle.draw(context));
            this.game.enemies.forEach(enemy => {
                enemy.draw(context);
            });
            this.game.explosions.forEach(explosion => {
                explosion.draw(context);
            });
            this.game.background.layer4.draw(context);
            this.game.ui.draw(context);
        }
    }

    class GameOverState extends State {
        constructor(game){
            super('GAME_OVER', game);
        }
        enter(){
            this.rank = { name: 'Deck Swabber', color: 'white' };
            if (this.game.score >= this.game.winningScore) {
                this.rank = { name: 'Knotz Admiral', color: '#ffd700' };
            } else if (this.game.score >= this.game.winningScore * 0.5) {
                this.rank = { name: 'Brigade Captain', color: '#c0c0c0' };
            }
        }
        handleInput(input){
            if (input === 'Enter'){
                this.game.setState(states.MAIN_MENU);
            }
        }
        update(deltaTime){
            this.game.background.update();
            this.game.background.layer4.update();
        }
        draw(context){
            this.game.background.draw(context);
            this.game.background.layer4.draw(context);
            
            // Stats Panel Background
            context.save();
            context.fillStyle = 'rgba(0, 0, 0, 0.7)';
            context.fillRect(this.game.width * 0.1, this.game.height * 0.1, this.game.width * 0.8, this.game.height * 0.8);
            context.strokeStyle = 'white';
            context.lineWidth = 2;
            context.strokeRect(this.game.width * 0.1, this.game.height * 0.1, this.game.width * 0.8, this.game.height * 0.8);
            context.restore();

            context.save();
            context.textAlign = 'center';
            context.fillStyle = 'white';
            context.shadowOffsetX = 3;
            context.shadowOffsetY = 3;
            context.shadowColor = 'black';
            
            // Title
            context.font = '50px ' + this.game.ui.fontFamily;
            context.fillText('Mission Report', this.game.width * 0.5, this.game.height * 0.2);

            // Rank
            context.font = '30px ' + this.game.ui.fontFamily;
            context.fillStyle = this.rank.color;
            context.fillText('Rank: ' + this.rank.name, this.game.width * 0.5, this.game.height * 0.3);

            // Stats
            context.textAlign = 'left';
            context.fillStyle = 'white';
            context.font = '22px ' + this.game.ui.fontFamily;
            const statsX = this.game.width * 0.3;
            const valueX = this.game.width * 0.65;
            const startY = this.game.height * 0.4;
            const lineHeight = 30;

            const accuracy = this.game.stats.projectilesFired > 0 ? ((this.game.stats.projectilesHit / this.game.stats.projectilesFired) * 100).toFixed(1) + '%' : '0.0%';

            context.fillText('Final Score:', statsX, startY);
            context.fillText(this.game.score, valueX, startY);
            context.fillText('Enemies Defeated:', statsX, startY + lineHeight);
            context.fillText(this.game.stats.enemiesDefeated, valueX, startY + lineHeight);
            context.fillText('Projectiles Fired:', statsX, startY + lineHeight * 2);
            context.fillText(this.game.stats.projectilesFired, valueX, startY + lineHeight * 2);
            context.fillText('Accuracy:', statsX, startY + lineHeight * 3);
            context.fillText(accuracy, valueX, startY + lineHeight * 3);
            context.fillText('Power-ups Collected:', statsX, startY + lineHeight * 4);
            context.fillText(this.game.stats.powerUpsCollected, valueX, startY + lineHeight * 4);
            context.fillText('Damage Taken:', statsX, startY + lineHeight * 5);
            context.fillText(this.game.stats.damageTaken, valueX, startY + lineHeight * 5);

            // Continue Prompt
            context.textAlign = 'center';
            context.font = '25px ' + this.game.ui.fontFamily;
            context.fillText('Press Enter to return to Main Menu', this.game.width * 0.5, this.game.height * 0.9);

            context.restore();
        }
    }
    
    class SoundController {
        constructor(){
            this.powerUpSound = document.getElementById('powerup');
            this.powerDownSound = document.getElementById('powerdown');
            this.explosionSound = document.getElementById('explosion');
            this.shotSound = document.getElementById('shot');
            this.hitSound = document.getElementById('hit');
            this.shieldSound = document.getElementById('shieldSound');
            this.backgroundSound = document.getElementById('backgroundSound');
        }
        playBackgroundSound() {
            this.backgroundSound.currentTime = 0;
            this.backgroundSound.play();
        }
        powerUp(){
            this.powerUpSound.currentTime = 0;
            this.powerUpSound.play();
        }
        powerDown(){
            this.powerDownSound.currentTime = 0;
            this.powerDownSound.play();
        }
        explosion(){
            this.explosionSound.currentTime = 0;
            this.explosionSound.play();
        }
        shot(){
            this.shotSound.currentTime = 0;
            this.shotSound.play();
        }
        hit(){
            this.hitSound.currentTime = 0;
            this.hitSound.play();
        }
        shield(){
            this.shieldSound.currentTime = 0;
            this.shieldSound.play();
        }
    }
    class Shield {
        constructor(game){
            this.game = game;
            this.width = this.game.player.width;
            this.height = this.game.player.height;
            this.frameX = 0;
            this.maxFrame = 24;
            this.image = document.getElementById('shieldImg');
            this.fps = 60;
            this.timer = 0;
            this.interval = 1000/this.fps;
        }
        update(deltaTime){
            if (this.frameX <= this.maxFrame) {
                if (this.timer > this.interval){
                    this.frameX++;
                    this.timer = 0;
                } else {
                    this.timer += deltaTime;
                }

            }
        }
        draw(context){
            context.drawImage(this.image, this.frameX * this.width, 0, this.width, this.height, this.game.player.x, this.game.player.y, this.width, this.height);
        }
        reset(){
            this.frameX = 0;
            this.game.sound.shield();
        }
    }
    class Projectile {
        constructor(game, x, y){
            this.game = game;
            this.x = x;
            this.y = y;
            this.width = 36.25;
            this.height = 20;
            this.speed = Math.random() * 0.2 +2.8;
            this.markedForDeletion = false;
            this.image = document.getElementById('fireball');
            this.frameX = 0;
            this.maxFrame = 3;
            this.fps = 20;
            this.timer = 0;
            this.interval = 1000/20;
        }
        update(deltaTime){
            this.x += this.speed;
            if (this.timer > this.interval){
                if (this.frameX < this.maxFrame) this.frameX++;
                else this.frameX = 0;
                this.timer = 0;
            } else {
                this.timer += deltaTime;
            }
            if (this.x > this.game.width * 0.8) this.markedForDeletion = true;
        }
        draw(context){
            context.drawImage(this.image, this.frameX * this.width, 0, this.width, this.height, this.x, this.y, this.width, this.height);
        }
    }
    class Particle {
        constructor(game, x, y){
            this.game = game;
            this.x = x;
            this.y = y;
            this.image = document.getElementById('gears');
            this.frameX = Math.floor(Math.random() * 3);
            this.frameY = Math.floor(Math.random() * 3);
            this.spriteSize = 50;
            this.sizeModifier = (Math.random() * 0.5 + 0.5).toFixed(1);
            this.size = this.spriteSize * this.sizeModifier;
            this.speedX = Math.random() * 6 - 3;
            this.speedY = Math.random() * -15;
            this.gravity = 0.5;
            this.markedForDeletion = false;
            this.angle = 0;
            this.va = Math.random() * 0.2 - 0.1;
            this.bounced = 0;
            this.bottomBounceBoundary = Math.random() * 80 + 60;
        }
        update(){
            this.angle += this.va;
            this.speedY += this.gravity;
            this.x -= this.speedX + this.game.speed;
            this.y += this.speedY;
            if (this.y > this.game.height + this.size || this.x < 0 - this.size) this.markedForDeletion = true;
            if (this.y > this.game.height - this.bottomBounceBoundary && this.bounced < 5){ //increase amount of particles
                this.bounced++;
                this.speedY *= -0.7;
            }
        }
        draw(context){
            context.save();
            context.translate(this.x, this.y);
            context.rotate(this.angle);
            context.drawImage(this.image, this.frameX * this.spriteSize, this.frameY * this.spriteSize, this.spriteSize, this.spriteSize, this.size * -0.5, this.size * -0.5, this.size, this.size);
            context.restore();
        }
    }
    class Player {
        constructor(game){
            this.game = game;
            this.width = 120;
            this.height = 190;
            this.x = 20;
            this.y = 100;
            this.frameX =0;
            this.frameY = 0;
            this.maxFrame = 37;
            this.speedY = 0;
            this.maxSpeed = 3;
            this.projectiles = []
            this.image = document.getElementById('player');
            this.powerUp = false;
            this.powerUpTimer = 0;
            this.powerUpLimit = 10000;
            this.health = 20;
            this.maxHealth = 20;
            this.recoil = 0;
        }
        update(deltaTime) {
            if (this.game.keys.includes('ArrowUp')) this.speedY = -this.maxSpeed;
            else if (this.game.keys.includes('ArrowDown')) this.speedY = this.maxSpeed;
            else this.speedY = 0;
            this.y += this.speedY;

            this.recoil *= 0.9;

            if (this.y > this.game.height - this.height* .5) this.y = this.game.height - this.height * .5
            else if (this.y < -this.height * 0.5) this.y = -this.height* 0.5
            
            this.projectiles.forEach(projectile => {
                projectile.update(deltaTime);
            });
            this.projectiles = this.projectiles.filter(projectile => !projectile.markedForDeletion);
            
            if (this.frameX < this.maxFrame){
                this.frameX++;
            } else {
                this.frameX = 0;
            }
            
            if (this.powerUp){
                if (this.powerUpTimer > this.powerUpLimit){
                    this.powerUpTimer = 0;
                    this.powerUp = false;
                    this.frameY = 0;
                    this.game.sound.powerDown();
                } else {
                    this.powerUpTimer += deltaTime;
                    this.frameY = 1;
                    this.game.ammo += 0.1;
                }
            }
        }
        draw(context) {
            if (this.game.debug) context.strokeRect(this.x, this.y, this.width, this.height);
            
            if (this.powerUp) {
                context.save();
                context.globalAlpha = 0.5 + Math.sin(this.game.gameTime * 0.01) * 0.2;
                context.fillStyle = '#ffffbd';
                context.beginPath();
                context.arc(this.x + this.width * 0.5, this.y + this.height * 0.5, this.width * 0.7, 0, Math.PI * 2);
                context.fill();
                context.restore();
            }

            this.projectiles.forEach(projectile => {
                projectile.draw(context);
            });
            
            context.drawImage(this.image, this.frameX * this.width, this.frameY * this.height, this.width, this.height, this.x + this.recoil, this.y, this.width, this.height)
        }
        shootTop(){
            if (this.game.ammo > 0) {
                this.projectiles.push(new Projectile(this.game, this.x + 80, this.y + 30));
                this.game.ammo--;
                this.recoil = -5;
                this.game.stats.projectilesFired++; // Track shots
            }
            this.game.sound.shot()
            if (this.powerUp) this.shootBottom();
        }
        shootBottom(){
            if (this.game.ammo > 0){
                this.projectiles.push(new Projectile(this.game, this.x + 80, this.y + 175));
            }
        }
        enterPowerUp(){
            this.powerUpTimer = 0;
            this.powerUp = true;
            if (this.game.ammo < this.game.maxAmmo) this.game.ammo = this.game.maxAmmo
            this.game.sound.powerUp();
            this.game.stats.powerUpsCollected++; // Track power-ups
        }
    }
    
    class Enemy {
        constructor(game){
            this.game = game;
            this.x = this.game.width;
            this.speedX = Math.random() * -1.5 - 0.5
            this.markedForDeletion = false;
            this.frameX = 0;
            this.frameY = 0;
            this.maxFrame = 37;
            this.isFlashing = false;
            this.flashTimer = 0;
            this.flashInterval = 100; // 100ms flash
        }
        update(deltaTime){
            this.x += this.speedX - this.game.speed;
            if (this.x + this.width < 0) this.markedForDeletion = true;
            
            if (this.frameX < this.maxFrame){
                this.frameX++;
            } else this.frameX = 0;

            if (this.isFlashing) {
                this.flashTimer += deltaTime;
                if (this.flashTimer > this.flashInterval) {
                    this.isFlashing = false;
                    this.flashTimer = 0;
                }
            }
        }
        draw(context){
            if (this.game.debug) context.strokeRect(this.x, this.y, this.width, this.height);
            
            context.save();
            
            if (this.isFlashing) {
                context.globalCompositeOperation = 'lighter';
            }
            
            context.drawImage(this.image, this.frameX *this.width, this.frameY * this.height, this.width, this.height, this.x, this.y, this.width, this.height);
            context.restore();

            if (this.game.debug){
                context.font = '20px Helvetica'
                context.fillText(this.lives, this.x, this.y)
            }
        }
        hit() {
            this.isFlashing = true;
            this.flashTimer = 0;
        }
    }
    class Angler1 extends Enemy {
        constructor(game){
            super(game);
            this.width = 228;
            this.height = 169;
            this.y = Math.random() * (this.game.height * 0.95 - this.height);
            this.image = document.getElementById('angler1');
            this.frameY  = Math.floor(Math.random() * 3);
            this.lives = 5;
            this.score = this.lives
        }
    }
    class Angler2 extends Enemy {
        constructor(game){
            super(game);
            this.width = 213;
            this.height = 165;
            this.y = Math.random() * (this.game.height * 0.95 - this.height);
            this.image = document.getElementById('angler2');
            this.frameY  = Math.floor(Math.random() * 2);
            this.lives = 6;
            this.score = this.lives
        }
    }
    class LuckyFish extends Enemy {
        constructor(game){
            super(game);
            this.width = 99;
            this.height = 95;
            this.y = Math.random() * (this.game.height * 0.95 - this.height);
            this.image = document.getElementById('lucky');
            this.frameY  = Math.floor(Math.random() * 2);
            this.lives = 5;
            this.score = 15
            this.type = 'lucky';
        }
    }
    class HiveWhale extends Enemy {
        constructor(game){
            super(game);
            this.width = 400;
            this.height = 227;
            this.y = Math.random() * (this.game.height * 0.95 - this.height);
            this.image = document.getElementById('hivewhale');
            this.frameY  = 0;
            this.lives = 20;
            this.score = this.lives
            this.type = 'hive';
            this.speedX = Math.random() * -1.2 - 0.2
        }
    }
    class Drone extends Enemy {
        constructor(game, x, y){
            super(game);
            this.width = 115;
            this.height = 95;
            this.x = x;
            this.y = y;
            this.image = document.getElementById('drone');
            this.frameY  = Math.floor(Math.random() *2);
            this.lives = 3;
            this.score = this.lives
            this.type = 'drone';
            this.speedX = Math.random() * -4.2 - 0.5
        }
    }
    class BulbWhale extends Enemy {
        constructor(game){
            super(game);
            this.width = 270;
            this.height = 219;
            this.y = Math.random() * (this.game.height * 0.95 - this.height);
            this.image = document.getElementById('bulbwhale');
            this.frameY  = Math.floor(Math.random() *2);
            this.lives = 20;
            this.score = this.lives
            this.speedX = Math.random() * -1.2 - 0.2
        }
    }
    class MoonFish extends Enemy {
        constructor(game){
            super(game);
            this.width = 227;
            this.height = 240;
            this.y = Math.random() * (this.game.height * 0.95 - this.height);
            this.image = document.getElementById('moonfish');
            this.frameY  = 0;
            this.lives = 8;
            this.score = this.lives
            this.speedX = Math.random() * -1.2 - 2
            this.type = 'moon'
        }
    }
    class Stalker extends Enemy {
        constructor(game){
            super(game);
            this.width = 243;
            this.height = 123;
            this.y = Math.random() * (this.game.height * 0.95 - this.height);
            this.image = document.getElementById('stalker');
            this.frameY  = 0;
            this.lives = 7;
            this.score = this.lives
            this.speedX = Math.random() * -1 - 1;
            this.type = 'stalker'
        }
    }
    class  Razorfin extends Enemy {
        constructor(game){
            super(game);
            this.width = 187;
            this.height = 149;
            this.y = Math.random() * (this.game.height * 0.95 - this.height);
            this.image = document.getElementById('razorfin');
            this.frameY  = 0;
            this.lives = 5;
            this.score = this.lives
            this.speedX = Math.random() * -1 - 1;
            this.type = 'razorfin'
        }
    }
    class Layer {
        constructor(game, image, speedModifier){
            this.game = game;
            this.image = image;
            this.speedModifier = speedModifier;
            this.width = 1768;
            this.height = 500
            this.x = 0;
            this.y = 0;

        }
        update(){
            if (this.x <= -this.width) this.x = 0;
            this.x -= this.game.speed * this.speedModifier;
        }
        draw(context){
            context.drawImage(this.image, this.x, this.y);
            context.drawImage(this.image, this.x + this.width, this.y);
        }

    }
    class Background {
        constructor(game){
            this.game = game;
            this.image1 = document.getElementById('layer1');
            this.image2 = document.getElementById('layer2');
            this.image3 = document.getElementById('layer3');
            this.image4 = document.getElementById('layer4');
            this.layer1 = new Layer(this.game, this.image1, 0.5);
            this.layer2 = new Layer(this.game, this.image2, 1);
            this.layer3 = new Layer(this.game, this.image3, 2);
            this.layer4 = new Layer(this.game, this.image4, 3);
            this.layers = [this.layer1, this.layer2, this.layer3];
        }
        update(){
            this.layers.forEach(layer => layer.update());
        }
        draw(context){
            this.layers.forEach(layer => layer.draw(context));

        }

    }
    class Explosion {
        constructor(game, x, y){
            this.game = game;
            this.frameX = 0;
            this.spriteHeight = 200;
            this.spriteWidth = 200;
            this.width = this.spriteWidth
            this.height = this.spriteHeight
            this.x = x - this.width * 0.5;
            this.y = y - this.height *0.5;
            this.fps = 15;
            this.timer = 0;
            this.interval = 1000/this.fps;
            this.markedForDeletion = false;
            this.maxFrame = 8
        }
        update(deltaTime){
            this.x -= this.game.speed;
            if (this.timer > this.interval){
                this.frameX++;
                this.timer = 0
            } else {
                this.timer += deltaTime
            }
            if (this.frameX> this.maxFrame) this.markedForDeletion = true;
        }
        draw(context){
            context.drawImage(this.image, this.frameX * this.spriteWidth, 0, this.spriteWidth, this.spriteHeight, this.x, this.y, this.width, this.height)
        }
    }
    class SmokeExplosion extends Explosion {
        constructor(game, x, y){
            super(game, x, y);
            this.image = document.getElementById('smokeExplosion');
            
        }
    }
    class FireExplosion extends Explosion{
        constructor(game, x, y){
            super(game, x, y);
            this.image = document.getElementById('fireExplosion');

        }
    }
    class UI {
        constructor(game){
            this.game = game;
            this.fontSize = 25;
            this.fontFamily = 'Bangers';
            this.color = 'white';
        }
        draw(context){
            context.save();
            context.fillStyle = this.color;
            context.shadowOffsetX = 2;
            context.shadowOffsetY = 2;
            context.shadowColor = 'black';
            context.shadowBlur = 2;
            context.font = this.fontSize + 'px ' + this.fontFamily;
            
            context.textAlign = 'left';
            context.fillText('Score: ' + this.game.score, 20, 40);

            const formattedTime = (this.game.gameTime * 0.001).toFixed(1);
            context.textAlign = 'center';
            context.fillText('Timer: ' + formattedTime, this.game.width / 2, 40);

            context.textAlign = 'left';
            context.fillText('Health:', 20, 80);
            const healthBarWidth = 150;
            const healthBarHeight = 15;
            const currentHealthWidth = (this.game.player.health / this.game.player.maxHealth) * healthBarWidth;
            context.fillStyle = 'red';
            context.fillRect(95, 68, healthBarWidth, healthBarHeight);
            context.fillStyle = 'green';
            context.fillRect(95, 68, currentHealthWidth > 0 ? currentHealthWidth : 0, healthBarHeight);

            context.fillStyle = this.color;
            if (this.game.player.powerUp) context.fillStyle = '#ffffbd';
            context.fillText('Ammo:', 20, 110);
            const ammoBarWidth = 150;
            const ammoBarHeight = 15;
            const currentAmmoWidth = (this.game.ammo / this.game.maxAmmo) * ammoBarWidth;
            context.fillStyle = 'gray';
            context.fillRect(95, 98, ammoBarWidth, ammoBarHeight);
            context.fillStyle = this.game.player.powerUp ? '#ffffbd' : 'orange';
            context.fillRect(95, 98, currentAmmoWidth, ammoBarHeight);

            context.restore();
        }
    }

    class Camera {
        constructor(game) {
            this.game = game;
            this.x = 0;
            this.y = 0;
            this.shakeDuration = 0;
            this.shakeMagnitude = 0;
        }
        update(deltaTime) {
            if (this.shakeDuration > 0) {
                this.shakeDuration -= deltaTime;
                this.x = (Math.random() - 0.5) * this.shakeMagnitude;
                this.y = (Math.random() - 0.5) * this.shakeMagnitude;
            } else {
                this.x = 0;
                this.y = 0;
            }
        }
        shake(duration, magnitude) {
            this.shakeDuration = duration;
            this.shakeMagnitude = magnitude;
        }
    }

    class Stats {
        constructor(game){
            this.game = game;
            this.reset();
        }
        reset(){
            this.projectilesFired = 0;
            this.projectilesHit = 0;
            this.enemiesDefeated = 0;
            this.damageTaken = 0;
            this.powerUpsCollected = 0;
        }
    }

    class Game {
        constructor(width, height){
            this.width = width;
            this.height = height; 
            this.background = new Background(this);
            this.player = new Player(this);
            this.input = new InputHandler(this);
            this.ui = new UI(this);
            this.sound = new SoundController();
            this.shield = new Shield(this);
            this.camera = new Camera(this);
            this.stats = new Stats(this);
            this.keys = [];
            this.enemies = [];
            this.particles = [];
            this.explosions = []
            this.enemyTimer = 0;
            this.enemyInterval = 2000;
            this.ammo = 20
            this.maxAmmo = 50
            this.ammoTimer = 0;
            this.ammoInterval = 350;
            this.score = 0;
            this.winningScore = 100;
            this.gameTime = 0;
            this.timeLimit = 60000;
            this.speed = 1
            this.debug = false;
            
            this.states = [new MainMenuState(this), new PlayingState(this), new GameOverState(this)];
            this.currentState = null;
            this.isFading = false;
            this.fadeAlpha = 0;
            this.fadeDirection = 1;
            this.fadeSpeed = 0.03;
            this.nextState = null;
            this.setState(states.MAIN_MENU, true);
        }
        update(deltaTime){
            if (this.isFading) {
                this.fadeAlpha += this.fadeDirection * this.fadeSpeed;
                if (this.fadeAlpha >= 1) {
                    this.fadeAlpha = 1;
                    this.currentState = this.states[this.nextState];
                    this.currentState.enter();
                    this.fadeDirection = -1;
                } else if (this.fadeAlpha <= 0) {
                    this.fadeAlpha = 0;
                    this.isFading = false;
                }
            } else {
                this.currentState.update(deltaTime);
            }
            this.camera.update(deltaTime);
        }
        draw(context){
            context.save();
            context.translate(this.camera.x, this.camera.y);

            this.currentState.draw(context);

            context.restore();

            if (this.isFading) {
                context.save();
                context.globalAlpha = this.fadeAlpha;
                context.fillStyle = 'black';
                context.fillRect(0, 0, this.width, this.height);
                context.restore();
            }
        }
        setState(state, immediate = false){
            if (immediate) {
                this.currentState = this.states[state];
                this.currentState.enter();
            } else if (!this.isFading) {
                this.isFading = true;
                this.fadeDirection = 1;
                this.nextState = state;
            }
        }
        addEnemy(){
            const randomize = Math.random();
            if (randomize < 0.1) this.enemies.push(new Angler1(this));
            else if (randomize < 0.3) this.enemies.push(new Stalker(this));
            else if (randomize < 0.5) this.enemies.push(new Razorfin(this));
            else if (randomize < 0.6) this.enemies.push(new Angler2(this));
            else if (randomize < 0.7) this.enemies.push(new HiveWhale(this));
            else if (randomize < 0.8) this.enemies.push(new BulbWhale(this));
            else if (randomize < 0.9) this.enemies.push(new MoonFish(this));
            else this.enemies.push(new LuckyFish(this));
        }
        addExplosion(enemy){
            const randomize = Math.random();
            if (randomize < 0.5) {
                this.explosions.push(new SmokeExplosion(this, enemy.x + enemy.width *.05, enemy.y + enemy.height * 0.5))
            } else {
                this.explosions.push(new FireExplosion(this, enemy.x + enemy.width *.05, enemy.y + enemy.height * 0.5))
            }
        }
        checkCollision(rect1, rect2) {
            return (    rect1.x < rect2.x + rect2.width &&
                        rect1.x + rect1.width > rect2.x &&
                        rect1.y < rect2.y + rect2.height &&
                        rect1.height + rect1.y > rect2.y)
        }
    }

    const game = new Game(canvas.width, canvas.height);
    let lastTime = 0;
    
    function animate(timeStamp){
        const deltaTime = timeStamp - lastTime;
        lastTime = timeStamp;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        game.draw(ctx);
        game.update(deltaTime);
        requestAnimationFrame(animate);
    }
    animate(0);
});