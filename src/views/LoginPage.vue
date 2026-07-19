<template>
    <v-theme-provider with-background class="login-page">
        <!-- Unscharfes Hintergrundbild + theme-abhängiger Schleier -->
        <div class="login-backdrop">
            <v-img
                src="/src/assets/images/header-banner.jpg"
                alt="Hintergrundbild"
                cover
                height="100%"
            />
            <div class="login-scrim"></div>
        </div>

        <div class="login-wrapper d-flex align-center justify-center pa-4">
            <v-card class="login-card pa-6 pa-sm-8" rounded="xl" elevation="12">
                <v-img src="/src/assets/images/logo.png" class="mx-auto" max-width="140" />

                <div class="text-center mt-6">
                    <div class="text-h6 font-weight-bold">Willkommen</div>
                    <div class="text-body-2 text-medium-emphasis mt-1">
                        Einstiegs- und Übersichtsseite fürs Gesangbuch 2026
                    </div>
                </div>

                <v-form ref="form" v-model="valid" lazy-validation class="mt-8">
                    <v-text-field
                        v-model="email"
                        :rules="[rules.required]"
                        label="Benutzername"
                        required
                        class="mb-2"
                        variant="outlined"
                        prepend-inner-icon="mdi-account-outline"
                        autocomplete="username"
                        @keydown.enter.prevent="submit"
                    ></v-text-field>

                    <v-text-field
                        v-model="password"
                        :rules="[rules.required]"
                        :append-inner-icon="show_password ? 'mdi-eye' : 'mdi-eye-off'"
                        :type="show_password ? 'text' : 'password'"
                        label="Passwort"
                        variant="outlined"
                        prepend-inner-icon="mdi-lock-outline"
                        autocomplete="current-password"
                        @keydown.enter.prevent="submit"
                        @click:append-inner="show_password = !show_password"
                    ></v-text-field>

                    <v-checkbox
                        v-model="remember_me"
                        label="Eingeloggt bleiben"
                        density="comfortable"
                        hide-details
                        class="mb-2"
                    ></v-checkbox>

                    <v-expand-transition>
                        <v-alert
                            v-if="loginError"
                            type="error"
                            variant="tonal"
                            density="comfortable"
                            class="mb-4"
                        >
                            {{ loginError }}
                        </v-alert>
                    </v-expand-transition>

                    <v-btn
                        block
                        size="large"
                        color="primary"
                        :loading="loadingLogin"
                        :disabled="!validate_login"
                        @click="submit"
                    >
                        Anmelden
                    </v-btn>
                </v-form>
            </v-card>
        </div>
    </v-theme-provider>
</template>

<script>
import { useUserStore } from '@/store/user';
import router from '@/router';

export default {
    name: 'LoginPage',
    data: () => ({
        user_store: useUserStore(),
        email: '',
        password: '',
        loginError: '',
        valid: false,
        loadingLogin: false,
        show_password: false,
        remember_me: false,
        rules: {
            required: (value) => !!value || 'Bitte ausfüllen',
            name_rules: [
                (v) => !!v || 'Bitte ausfüllen',
                (v) => (v && v.length >= 1) || 'Mindestens 1 Buchstabe',
                (v) => (v && v.length <= 20) || 'Maximal 20 Buchstaben',
            ],
            emailRules: [
                (v) => !!v || 'Bitte geben Sie eine gültige E-Mail-Adresse an.',
                (v) => /.+@.+\..+/.test(v) || 'Bitte geben Sie eine gültige E-Mail-Adresse an.',
            ],
            password_confirmation_rule: [
                (v) => !!v || 'Bitte ausfüllen',
                (v) => (v && v.length >= 8) || 'Mindestens 8 Zeichen',
                (v) => (v && /\d/.test(v)) || 'Passwort muss eine Zahl enthalten',
                (v) =>
                    (v && /[ `!@#$%^&§*()_+\-=[\]{};':"\\|,.<>/?~]/.test(v)) ||
                    'Passwort muss ein Sonderzeichen enthalten',
            ],
        },
        input_mail: '',
        query: undefined,
    }),
    computed: {
        validate_login() {
            return this.password !== '' && this.email !== '';
        },
    },
    mounted() {
        console.log(import.meta.env.VITE_BACKEND_URL);
        if (this.user_store.is_logged_in) {
            const redirectPath = this.$route.query.redirect || '/dashboard';
            router.push(redirectPath);
        }
    },
    methods: {
        async submit() {
            const valid = await this.$refs.form.validate();
            if (valid.valid) {
                this.loadingLogin = true;
                this.user_store
                    .login(
                        {
                            username: this.email,
                            password: this.password,
                        },
                        this.remember_me,
                    )
                    .then(() => {
                        const redirectPath = this.$route.query.redirect || '/dashboard';
                        router.push(redirectPath);
                        this.loadingLogin = false;
                    })
                    .catch((error) => {
                        console.log(error);
                        this.loginError =
                            'Das war leider das falsche Passwort. Bitte versuche es erneut.';
                        this.loadingLogin = false;
                    });
            }
        },
    },
};
</script>

<style scoped lang="scss">
.login-page {
    position: relative;
    min-height: 100vh;
}

.login-backdrop {
    position: fixed;
    inset: 0;
    z-index: 0;
    overflow: hidden;

    :deep(.v-img) {
        // Leicht hochskalieren, damit der Weichzeichner keine harten Ränder zeigt.
        filter: blur(4px);
        transform: scale(1.06);
    }
}

// Theme-abhängiger Schleier: hellt das Bild im Light-Mode auf und dunkelt es
// im Dark-Mode ab, damit die Karte in beiden Themes gut lesbar bleibt.
.login-scrim {
    position: absolute;
    inset: 0;
    background: rgba(var(--v-theme-surface), 0.55);
}

.login-wrapper {
    position: relative;
    z-index: 1;
    min-height: 100vh;
}

.login-card {
    width: 100%;
    max-width: 420px;
}

@media (max-width: 600px) {
    .login-card {
        max-width: 100%;
    }
}
</style>
