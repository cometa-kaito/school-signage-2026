// auth.js - 認証UI コンポーネント
import { login, logout, onAuthChange, isUserAdmin, getCurrentUser } from './config.js';

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

    // スタイルを追加
    addLoginStyles();

    // フォームのイベントリスナー
    const form = document.getElementById('loginForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');
        const loginBtn = document.getElementById('loginBtn');

        // ボタンを無効化
        loginBtn.disabled = true;
        loginBtn.textContent = 'ログイン中...';
        errorDiv.style.display = 'none';

        try {
            const result = await login(email, password);
            
            if (result.success) {
                // 管理者権限を確認
                const isAdmin = await isUserAdmin(result.user);
                
                if (isAdmin) {
                    // ログイン成功
                    if (onSuccess) {
                        onSuccess(result.user);
                    }
                } else {
                    // 管理者権限なし
                    await logout();
                    errorDiv.textContent = '管理者権限がありません';
                    errorDiv.style.display = 'block';
                }
            } else {
                // ログイン失敗
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
 * @param {string} containerId - ボタンを挿入するコンテナのID
 * @param {Function} onLogout - ログアウト後のコールバック
 */
export function createLogoutButton(containerId, onLogout) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const user = getCurrentUser();
    
    container.innerHTML = `
        <div class="user-info">
            <span class="user-email">${user?.email || '---'}</span>
            <button id="logoutBtn" class="logout-btn">ログアウト</button>
        </div>
    `;

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
 * @param {Object} options - オプション
 * @param {string} options.loginContainerId - ログインフォームのコンテナID
 * @param {string} options.appContainerId - アプリ本体のコンテナID
 * @param {string} options.userInfoContainerId - ユーザー情報のコンテナID（オプション）
 * @param {Function} options.onLogin - ログイン成功時のコールバック
 * @param {Function} options.onLogout - ログアウト時のコールバック
 */
export function initAuth(options) {
    const {
        loginContainerId = 'loginContainer',
        appContainerId = 'appContainer',
        userInfoContainerId = 'userInfo',
        onLogin,
        onLogout
    } = options;

    const loginContainer = document.getElementById(loginContainerId);
    const appContainer = document.getElementById(appContainerId);

    // 初期状態：両方非表示
    if (loginContainer) loginContainer.style.display = 'none';
    if (appContainer) appContainer.style.display = 'none';

    // 認証状態を監視
    onAuthChange(async (user) => {
        if (user) {
            // ログイン中
            const isAdmin = await isUserAdmin(user);
            
            if (isAdmin) {
                // 管理者：アプリを表示
                if (loginContainer) loginContainer.style.display = 'none';
                if (appContainer) appContainer.style.display = 'block';
                
                // ユーザー情報エリアがあればログアウトボタンを設置
                if (userInfoContainerId) {
                    createLogoutButton(userInfoContainerId, onLogout);
                }
                
                if (onLogin) onLogin(user);
            } else {
                // 管理者でない：ログアウトしてログイン画面を表示
                await logout();
                showLoginForm();
            }
        } else {
            // 未ログイン：ログイン画面を表示
            showLoginForm();
        }
    });

    function showLoginForm() {
        if (appContainer) appContainer.style.display = 'none';
        if (loginContainer) {
            loginContainer.style.display = 'flex';
            createLoginForm(loginContainerId, (user) => {
                // ログイン成功後、画面を再描画
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

/**
 * ログイン画面用のスタイルを追加
 */
function addLoginStyles() {
    if (document.getElementById('authStyles')) return;

    const style = document.createElement('style');
    style.id = 'authStyles';
    style.textContent = `
        .login-container {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
        }

        .login-box {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            width: 100%;
            max-width: 400px;
        }

        .login-box h2 {
            margin: 0 0 30px 0;
            text-align: center;
            color: #333;
            font-size: 24px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #555;
            font-size: 14px;
        }

        .form-group input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e1e1e1;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s, box-shadow 0.3s;
            box-sizing: border-box;
        }

        .form-group input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
        }

        .login-btn {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .login-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
        }

        .login-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }

        .error-message {
            background: #fee;
            color: #c00;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
            text-align: center;
        }

        .login-note {
            margin-top: 20px;
            text-align: center;
            color: #888;
            font-size: 12px;
        }

        .user-info {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .user-email {
            font-size: 14px;
            color: #666;
        }

        .logout-btn {
            padding: 8px 16px;
            background: #f44336;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.3s;
        }

        .logout-btn:hover {
            background: #d32f2f;
        }

        @media (max-width: 480px) {
            .login-box {
                padding: 30px 20px;
            }
        }
    `;
    document.head.appendChild(style);
}