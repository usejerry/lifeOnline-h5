<script setup lang="ts">
import {
  PhArrowRight,
  PhArrowLeft,
  PhCheck,
  PhEnvelopeSimple,
  PhEye,
  PhEyeSlash,
  PhLockKey,
  PhUser,
} from '@phosphor-icons/vue'
import axios from 'axios'
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { register } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const form = reactive({ account: '', password: '', rememberMe: true })
const registerForm = reactive({ username: '', email: '', confirmPassword: '' })
const mode = ref<'login' | 'register'>('login')
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const noticeMessage = ref('')

const isLogin = computed(() => mode.value === 'login')
const canSubmit = computed(() =>
  isLogin.value
    ? Boolean(form.account.trim() && form.password.length >= 6)
    : Boolean(
        registerForm.username.trim().length >= 3 &&
        registerForm.email.includes('@') &&
        form.password.length >= 6 &&
        form.password === registerForm.confirmPassword,
      ),
)

function showRegister() {
  if (form.account.includes('@')) registerForm.email = form.account
  else registerForm.username = form.account
  mode.value = 'register'
  errorMessage.value = ''
  noticeMessage.value = ''
}

function showLogin() {
  mode.value = 'login'
  errorMessage.value = ''
  noticeMessage.value = ''
}

async function handleSubmit() {
  if (!canSubmit.value || loading.value) return

  loading.value = true
  errorMessage.value = ''
  noticeMessage.value = ''

  try {
    if (!isLogin.value) {
      await register({
        username: registerForm.username,
        email: registerForm.email,
        password: form.password,
      })
      form.account = registerForm.email || registerForm.username
      form.password = ''
      mode.value = 'login'
      noticeMessage.value = '账号创建成功，请登录继续探索'
      return
    }

    await authStore.signIn(form)
    const redirect = route.query.redirect
    const target =
      typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
        ? redirect
        : '/today'
    await router.replace(target)
  } catch (error) {
    errorMessage.value = axios.isAxiosError(error)
      ? (error.response?.data?.message ?? '请求失败，请稍后重试')
      : '发生未知错误，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="postcard-hero" aria-label="人生支线街巷风景">
      <RouterLink class="back-link" to="/today" aria-label="返回今日支线">
        <PhArrowLeft aria-hidden="true" />返回
      </RouterLink>
      <RouterLink class="brand" to="/today" aria-label="返回今日支线">
        <span>人生支线</span>
        <small>你的生活，还有未读章节</small>
      </RouterLink>
    </section>

    <section class="paper-panel">
      <div class="form-wrap">
        <header>
          <h1>
            <template v-if="isLogin"><span>回来</span>看看，<br />今天会遇见什么</template>
            <template v-else><span>创建</span>账号，<br />开启你的第一条支线</template>
          </h1>
        </header>

        <form novalidate @submit.prevent="handleSubmit">
          <template v-if="isLogin">
            <label for="account">邮箱或用户名</label>
            <div class="input-wrap">
              <PhEnvelopeSimple aria-hidden="true" />
              <input
                id="account"
                v-model.trim="form.account"
                name="account"
                type="text"
                autocomplete="username"
                placeholder="name@example.com"
                required
              />
            </div>
          </template>

          <template v-else>
            <label for="username">用户名</label>
            <div class="input-wrap">
              <PhUser aria-hidden="true" />
              <input
                id="username"
                v-model.trim="registerForm.username"
                name="username"
                type="text"
                autocomplete="username"
                placeholder="至少 3 个字符"
                minlength="3"
                maxlength="50"
                required
              />
            </div>

            <label for="email">邮箱</label>
            <div class="input-wrap">
              <PhEnvelopeSimple aria-hidden="true" />
              <input
                id="email"
                v-model.trim="registerForm.email"
                name="email"
                type="email"
                autocomplete="email"
                placeholder="name@example.com"
                required
              />
            </div>
          </template>

          <label for="password">密码</label>
          <div class="input-wrap">
            <PhLockKey aria-hidden="true" />
            <input
              id="password"
              v-model="form.password"
              name="password"
              :type="showPassword ? 'text' : 'password'"
              :autocomplete="isLogin ? 'current-password' : 'new-password'"
              placeholder="至少 6 位密码"
              minlength="6"
              required
            />
            <button
              class="eye-button"
              type="button"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              @click="showPassword = !showPassword"
            >
              <PhEyeSlash v-if="showPassword" />
              <PhEye v-else />
            </button>
          </div>

          <template v-if="!isLogin">
            <label for="confirm-password">确认密码</label>
            <div class="input-wrap">
              <PhLockKey aria-hidden="true" />
              <input
                id="confirm-password"
                v-model="registerForm.confirmPassword"
                name="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="再次输入密码"
                minlength="6"
                required
              />
            </div>
          </template>

          <div v-if="isLogin" class="form-options">
            <label class="checkbox">
              <input v-model="form.rememberMe" type="checkbox" />
              <span aria-hidden="true"><PhCheck weight="bold" /></span>
              记住我
            </label>
            <a href="#" @click.prevent>忘记密码？</a>
          </div>

          <p v-if="noticeMessage" class="notice" role="status">{{ noticeMessage }}</p>
          <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

          <button class="submit-button" type="submit" :disabled="!canSubmit || loading">
            <span v-if="loading" class="spinner"></span>
            {{
              loading
                ? isLogin
                  ? '正在登录...'
                  : '正在创建...'
                : isLogin
                  ? '继续探索'
                  : '创建账号'
            }}
            <PhArrowRight v-if="!loading" aria-hidden="true" />
          </button>
        </form>

        <p class="signup">
          {{ isLogin ? '还没有账号？' : '已经有账号？' }}
          <a href="#" @click.prevent="isLogin ? showRegister() : showLogin()">
            {{ isLogin ? '创建账号' : '返回登录' }}
          </a>
        </p>

        <nav class="legal" aria-label="法律信息">
          <a href="#" @click.prevent>隐私政策</a><i></i><a href="#" @click.prevent>服务条款</a>
        </nav>
      </div>
    </section>
  </main>
</template>

<style scoped lang="less">
.auth-page {
  width: min(100%, 430px);
  min-height: 100svh;
  margin: 0 auto;
  overflow: clip;
  color: #172426;
  background: #f8f1e6;
  box-shadow: 0 0 70px rgba(0, 0, 0, 0.28);
}

.postcard-hero {
  position: relative;
  height: 370px;
  background: url('@/assets/lane-quest.png') center 45% / cover no-repeat;

  &::after {
    position: absolute;
    inset: 0;
    background: linear-gradient(110deg, rgba(255, 238, 191, 0.13), transparent 48%);
    content: '';
  }
}

.brand {
  position: absolute;
  z-index: 1;
  top: max(48px, calc(env(safe-area-inset-top) + 24px));
  left: 30px;
  display: flex;
  flex-direction: column;
  color: #142528;
  text-decoration: none;
  text-shadow: 0 2px 18px rgba(255, 249, 229, 0.45);

  span {
    font:
      600 26px/1.2 'Noto Serif SC',
      serif;
    letter-spacing: 0.15em;
  }

  small {
    margin-top: 9px;
    font:
      500 11px 'Noto Serif SC',
      serif;
    letter-spacing: 0.11em;
    text-decoration: underline wavy rgba(233, 104, 80, 0.65);
    text-underline-offset: 7px;
  }
}

.back-link {
  position: absolute;
  z-index: 2;
  top: max(18px, env(safe-area-inset-top));
  right: 18px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 11px;
  color: #f8f1e7;
  border-radius: 999px;
  background: rgba(13, 28, 30, 0.58);
  backdrop-filter: blur(10px);
  font-size: 13px;
  text-decoration: none;

  svg {
    width: 17px;
    height: 17px;
  }
}

.paper-panel {
  position: relative;
  z-index: 2;
  min-height: calc(100svh - 200px);
  margin-top: -170px;
  padding: 170px 30px calc(16px + env(safe-area-inset-bottom));
  background: url('@/assets/login-paper.png') top center / 100% 100% no-repeat;
}

.form-wrap {
  width: 100%;
  margin: 0 auto;

  header {
    margin-bottom: 24px;

    h1 {
      width: 94%;
      margin: 0;
      font:
        600 clamp(31px, 8.5vw, 37px) / 1.35 'Noto Serif SC',
        serif;
      letter-spacing: -0.055em;

      span {
        color: #e96850;
        text-decoration: underline wavy rgba(91, 124, 81, 0.75);
        text-decoration-thickness: 1.5px;
        text-underline-offset: 8px;
      }
    }
  }
}

form > label {
  display: block;
  margin: 14px 0 7px;
  font-size: 13px;
  font-weight: 700;
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;

  > svg {
    position: absolute;
    left: 16px;
    width: 20px;
    height: 20px;
    color: #7d817d;
    pointer-events: none;
  }

  input {
    width: 100%;
    height: 50px;
    padding: 0 48px;
    color: #172426;
    border: 1px solid #cfc8bc;
    border-radius: 14px;
    outline: none;
    background: rgba(255, 253, 248, 0.64);
    transition:
      border 0.2s,
      box-shadow 0.2s,
      background 0.2s;

    &::placeholder {
      color: #a6a39c;
    }

    &:focus {
      border-color: #e96850;
      background: #fffdf8;
      box-shadow: 0 0 0 4px rgba(233, 104, 80, 0.12);
    }
  }
}

.eye-button {
  position: absolute;
  right: 8px;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  color: #7d817d;
  border: 0;
  background: transparent;
  cursor: pointer;

  svg {
    width: 21px;
    height: 21px;
  }
}

.form-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 14px 0 16px;
  font-size: 13px;

  a {
    color: #e45f48;
    font-weight: 600;
    text-decoration: none;
  }
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #606763;
  cursor: pointer;

  input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }

  span {
    display: grid;
    place-items: center;
    width: 19px;
    height: 19px;
    color: transparent;
    border: 1px solid #bdb7ad;
    border-radius: 5px;
    background: #fffdf8;

    svg {
      width: 13px;
      height: 13px;
    }
  }

  input:checked + span {
    color: #fff;
    border-color: #ef6b52;
    background: #ef6b52;
  }

  input:focus-visible + span {
    outline: 3px solid rgba(233, 104, 80, 0.22);
    outline-offset: 2px;
  }
}

.error,
.notice {
  margin: 14px 0;
  padding: 10px 12px;
  border-radius: 9px;
  font-size: 12px;
}

.error {
  color: #a43b2c;
  background: #fce5df;
}

.notice {
  color: #28764a;
  background: #e3f1e6;
}

.submit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 50px;
  gap: 10px;
  margin-top: 16px;
  color: #fff;
  border: 0;
  border-radius: 15px;
  background: linear-gradient(105deg, #ff5943, #f16b52);
  box-shadow: 0 14px 28px rgba(222, 91, 67, 0.22);
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s,
    opacity 0.2s;

  svg {
    width: 19px;
    height: 19px;
  }

  &:hover:not(:disabled) {
    box-shadow: 0 17px 32px rgba(222, 91, 67, 0.3);
    transform: translateY(-2px);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.78;
  }
}

.spinner {
  width: 17px;
  height: 17px;
  border: 2px solid rgba(255, 255, 255, 0.42);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.signup {
  margin: 17px 0 0;
  color: #777b77;
  text-align: center;
  font-size: 13px;

  a {
    margin-left: 5px;
    color: #e45f48;
    font-weight: 600;
    text-decoration: none;
  }
}

.legal {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin-top: 12px;
  padding-top: 14px;
  border-top: 1px dashed rgba(125, 118, 104, 0.28);
  color: #989991;
  font-size: 11px;

  a {
    text-decoration: none;
  }

  i {
    width: 1px;
    height: 12px;
    background: #cbc5ba;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (min-width: 700px) {
  .postcard-hero {
    height: 390px;
  }

  .paper-panel {
    margin-top: -180px;
    padding-top: 180px;
  }
}

@media (max-height: 740px) {
  .postcard-hero {
    height: 340px;
  }

  .paper-panel {
    margin-top: -165px;
    padding-top: 165px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
