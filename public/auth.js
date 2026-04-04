// auth.js - 認証UIコンポーネント（マルチテナント対応）

import {
    login, logout, onAuthChange, isUserAdmin, isUserEditor,
    getCurrentUser, getUserClaims
} from './config.js';

// ========================================
// ログインフォーム
// ========================================

/**
 * ログインフォームを生成してDOMに挿入
 * @param {string} containerId - フォームを挿入するコンテナのID
 * @param {Function} onSuccess - ログイン成功時のコールバック
 */
export function createLoginForm(containerId, onSuccess) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container #${containerId} not found`);
        return;
    }

    container.innerHTML = `
        <div class="login-container">
            <div class="login-box">
                <h2>🔐 管理者ログイン</h2>
                <form id="loginForm">
                    <div class="form-group">
                        <label for="email">メールアドレス</label>
                        <input type="email" id="email" name="email" required
                               placeholder="admin@example.com" autocomplete="email">
                    </div>
                    <div class="form-group">
                        <label for="password">パスワード</label>
                        <input type="password" id="password" name="password" required
                               placeholder="パスワードを入力" autocomplete="current-password">
                    </div>
                    <div id="loginError" class="error-message" style="display: none;"></div>
                    <button type="submit" id="loginBtn" class="login-btn">
                        ログイン
                    </button>
                </form>
                <p class="login-note">※管理者のみログインできます</p>
            </div>
        </div>
    `;

    const form = document.getElementById('loginForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');
        const loginBtn = document.getElementById('loginBtn');

        loginBtn.disabled = true;
        loginBtn.textContent = 'ログイン中...';
        errorDiv.style.display = 'none';

        try {
            const result = await login(email, password);

            if (result.success) {
                const isAdmin = await isUserAdmin(result.user);

                if (isAdmin) {
                    if (onSuccess) {
                        onSuccess(result.user);
                    }
                } else {
                    await logout();
                    errorDiv.textContent = '管理者権限がありません';
                    errorDiv.style.display = 'block';
                }
            } else {
                errorDiv.textContent = result.error;
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            errorDiv.textContent = 'エラーが発生しました';
            errorDiv.style.display = 'block';
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'ログイン';
        }
    });
}

/**
 * ログアウトボタンを生成
 */
export function createLogoutButton(containerId, onLogout) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const user = getCurrentUser();

    container.innerHTML = `
        <div class="user-info">
            <span class="user-email">${user?.email || '---'}</span>
            <span id="user-role-badge" class="role-badge"></span>
            <button id="logoutBtn" class="logout-btn">ログアウト</button>
        </div>
    `;

    // ロールバッジを表示
    if (user) {
        getUserClaims(user).then(claims => {
            const badge = document.getElementById('user-role-badge');
            if (!badge) return;
            if (claims.systemRole === 'system_admin' || claims.admin) {
                badge.textContent = 'システム管理者';
                badge.classList.add('badge-admin');
            } else if (claims.editor) {
                badge.textContent = 'エディター';
                badge.classList.add('badge-editor');
            }
        });
    }

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await logout();
        if (onLogout) {
            onLogout();
        } else {
            window.location.reload();
        }
    });
}

/**
 * 認証状態に基づいて画面を切り替え
 * editor権限でもダッシュボードにアクセス可能に
 */
export function initAuth(options) {
    const {
        loginContainerId = 'loginContainer',
        appContainerId = 'appContainer',
        userInfoContainerId = 'userInfo',
        requireAdmin = true,
        onLogin,
        onLogout
    } = options;

    const loginContainer = document.getElementById(loginContainerId);
    const appContainer = document.getElementById(appContainerId);

    if (loginContainer) loginContainer.style.display = 'none';
    if (appContainer) appContainer.style.display = 'none';

    onAuthChange(async (user) => {
        if (user) {
            let hasAccess = false;

            if (requireAdmin) {
                hasAccess = await isUserAdmin(user);
            } else {
                // editor以上でアクセス可
                hasAccess = await isUserEditor(user);
            }

            if (hasAccess) {
                if (loginContainer) loginContainer.style.display = 'none';
                if (appContainer) appContainer.style.display = 'block';

                if (userInfoContainerId) {
                    createLogoutButton(userInfoContainerId, onLogout);
                }

                if (onLogin) onLogin(user);
            } else {
                await logout();
                showLoginForm();
            }
        } else {
            showLoginForm();
        }
    });

    function showLoginForm() {
        if (appContainer) appContainer.style.display = 'none';
        if (loginContainer) {
            loginContainer.style.display = 'flex';
            createLoginForm(loginContainerId, (user) => {
                if (loginContainer) loginContainer.style.display = 'none';
                if (appContainer) appContainer.style.display = 'block';
                if (userInfoContainerId) {
                    createLogoutButton(userInfoContainerId, onLogout);
                }
                if (onLogin) onLogin(user);
            });
        }
    }
}

// ログイン画面のスタイルは auth-style.css と common.css で提供
