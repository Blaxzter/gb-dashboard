<template>
  <div class="background">
    <v-img src="/src/assets/images/header-banner.jpg" alt="Hintergrund bild" cover />
  </div>
	<div class="login-wrapper d-flex align-center justify-center">
		<div class="login-card">
			<div>
				<!-- on dashboard show logo -->
				<v-img
					src="/src/assets/images/logo.png"
					style="display: block; margin: auto; max-width: 150px"
				/>
			</div>
			<!-- slogan -->
			<div class="d-flex justify-center mt-8">
				<span class="mb-4 text-body-1">Willkommen auf der Seite fürs<br>Gesangbuch 2026</span>
			</div>

      <v-container fluid>
        <v-form ref="form" v-model="valid" lazy-validation>
          <v-text-field
            v-model="email"
            @keydown.enter.prevent="submit"
            :rules="[rules.required]"
            label="Benutzernamen"
            required
            class="mb-3"
            variant="outlined"
          ></v-text-field>

          <v-text-field
            v-model="password"
            @keydown.enter.prevent="submit"
            :rules="[rules.required]"
            :append-icon="show_password ? 'mdi-eye' : 'mdi-eye-off'"
            :type="show_password ? 'text' : 'password'"
            @click:append="show_password = !show_password"
            label="Passwort"
            class="mb-3"
            variant="outlined"
          ></v-text-field>

          <v-alert v-if="loginError" type="error" dismissible transition="scale-transition">
            {{ loginError }}
          </v-alert>

          <div class="d-flex justify-center align-center flex-column mt-4">
            <v-btn
              size="large"
              style="width: 200px"
              :loading="loadingLogin"
              :disabled="!validate_login"
              color="success"
              @click="submit"
            >
              Login
            </v-btn>
          </div>
        </v-form>
      </v-container>
		</div>
	</div>
</template>

<script>
import { useUserStore } from '@/store/user'
import router from '@/router'

export default {
	name: 'LoginPage',
  mounted() {
    if (this.user_store.user) {
      router.push('dashboard')
    }
  },
  data: () => ({
    user_store: useUserStore(),
    email: '',
    password: '',
    loginError: '',
    valid: false,
    loadingLogin: false,
    show_password: false,
		rules: {
			required: (value) => !!value || 'Bitte ausfüllen',
			name_rules: [
				(v) => !!v || 'Bitte ausfüllen',
				(v) => (v && v.length >= 1) || 'Mindestens 1 Buchstabe',
				(v) => (v && v.length <= 20) || 'Maximal 20 Buchstaben'
			],
			emailRules: [
				(v) => !!v || 'Bitte geben Sie eine gültige E-Mail-Adresse an.',
				(v) => /.+@.+\..+/.test(v) || 'Bitte geben Sie eine gültige E-Mail-Adresse an.'
			],
			password_confirmation_rule: [
				(v) => !!v || 'Bitte ausfüllen',
				(v) => (v && v.length >= 8) || 'Mindestens 8 Zeichen',
				(v) => (v && /\d/.test(v)) || 'Passwort muss eine Zahl enthalten',
				(v) =>
					(v && /[ `!@#$%^&§*()_+\-=[\]{};':"\\|,.<>/?~]/.test(v)) ||
					'Passwort muss ein Sonderzeichen enthalten'
			]
		},
		input_mail: '',
		query: undefined
	}),
  computed: {
    validate_login() {
      return this.password !== '' && this.email !== ''
    }
  },
	methods: {
    async submit() {
      const valid = await this.$refs.form.validate()
      if (valid.valid) {
        this.loadingLogin = true
        this.user_store
          .login({
            username: this.email,
            password: this.password
          })
          .then(() => {
            router.push('/')
            this.loadingLogin = false
          })
          .catch((error) => {
            console.log(error)
            this.loginError = "Das war leider das falsche Passwort. Bitte versuche es erneut."
            this.loadingLogin = false
          })
      }
    }
	}
}
</script>

<style>
.background {
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: -1000;
  position: fixed;
  height: 100vh;
  width: 100vw;
  filter: blur(3px) opacity(0.7);
}

.login-wrapper {
	height: 100vh;

	.login-card {
		background-color: white;
		padding: 2rem;
		border-radius: 10px;
		max-width: 400px;
		min-width: 400px;
	}
}
</style>
