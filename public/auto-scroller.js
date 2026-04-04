// auto-scroller.js - 自動スクロール機能

const USER_PAUSE_DURATION = 5000; // ユーザー操作後の一時停止時間

/**
 * 自動スクローラークラス
 * コンテンツがコンテナからはみ出す場合に、上下に自動スクロールする
 */
export class AutoScroller {
    constructor(element, pixelsPerSecond = 25) {
        this.element = element;
        this.speed = pixelsPerSecond;
        this.animationId = null;
        this.timeoutId = null;
        this.direction = 1;
        this.isPaused = false;
        this.isUserPaused = false;
        this.lastTime = 0;
        this.pauseAtEnds = 2500;
        this.startDelay = 2000;

        this.handleUserInteraction = this.handleUserInteraction.bind(this);
        this.element.addEventListener('mousedown', this.handleUserInteraction);
        this.element.addEventListener('touchstart', this.handleUserInteraction, { passive: true });
        this.element.addEventListener('wheel', this.handleUserInteraction, { passive: true });
    }

    handleUserInteraction() {
        this.pauseForUser();
    }

    pauseForUser() {
        this.isUserPaused = true;
        this.pause();

        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(() => {
            this.isUserPaused = false;
            this.resume();
        }, USER_PAUSE_DURATION);
    }

    start() {
        this.timeoutId = setTimeout(() => {
            this.checkAndScroll();
        }, this.startDelay);
    }

    pause() {
        this.isPaused = true;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    resume() {
        if (this.isUserPaused) return;
        this.isPaused = false;
        this.checkAndScroll();
    }

    destroy() {
        this.pause();
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.element.removeEventListener('mousedown', this.handleUserInteraction);
        this.element.removeEventListener('touchstart', this.handleUserInteraction);
        this.element.removeEventListener('wheel', this.handleUserInteraction);
    }

    checkAndScroll() {
        if (this.isPaused || this.isUserPaused) return;

        const el = this.element;
        const overflow = el.scrollHeight - el.clientHeight;

        if (overflow <= 3) {
            this.timeoutId = setTimeout(() => this.checkAndScroll(), 3000);
            return;
        }

        this.animate();
    }

    animate() {
        if (this.isPaused || this.isUserPaused) return;

        const el = this.element;
        const overflow = el.scrollHeight - el.clientHeight;

        if (overflow <= 3) {
            this.timeoutId = setTimeout(() => this.checkAndScroll(), 3000);
            return;
        }

        this.lastTime = performance.now();

        const step = (currentTime) => {
            if (this.isPaused || this.isUserPaused) return;

            const deltaTime = (currentTime - this.lastTime) / 1000;
            this.lastTime = currentTime;

            const actualSpeed = this.direction === 1 ? this.speed : this.speed * 1.5;
            el.scrollTop += actualSpeed * deltaTime * this.direction;

            if (this.direction === 1 && el.scrollTop >= overflow) {
                el.scrollTop = overflow;
                this.direction = -1;
                this.timeoutId = setTimeout(() => this.animate(), this.pauseAtEnds);
                return;
            }

            if (this.direction === -1 && el.scrollTop <= 0) {
                el.scrollTop = 0;
                this.direction = 1;
                this.timeoutId = setTimeout(() => this.animate(), this.pauseAtEnds);
                return;
            }

            this.animationId = requestAnimationFrame(step);
        };

        this.animationId = requestAnimationFrame(step);
    }
}

/**
 * 自動スクロールを開始
 * @param {Map} autoScrollers - 管理用Map
 */
export function startAutoScroll(autoScrollers) {
    stopAutoScroll(autoScrollers);

    const scrollTargets = [
        document.querySelector('.schedule-scroll-area'),
        document.getElementById('notice-list'),
        document.querySelector('.table-wrapper')
    ].filter(el => el);

    scrollTargets.forEach((el) => {
        const scroller = new AutoScroller(el, 25);
        autoScrollers.set(el, scroller);
        scroller.start();
    });
}

/**
 * 自動スクロールを停止
 * @param {Map} autoScrollers - 管理用Map
 */
export function stopAutoScroll(autoScrollers) {
    autoScrollers.forEach(scroller => scroller.destroy());
    autoScrollers.clear();
}
