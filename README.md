# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Firebase Authentication

O app usa o Firebase JS SDK para cadastro, login e redefinição de senha por e-mail, com a sessão persistida no dispositivo.

1. No Firebase Console, abra o projeto e adicione um **app Web**. Copie os valores da configuração fornecida pelo Firebase.
2. Em **Authentication > Sign-in method**, habilite **E-mail/senha**.
3. Copie `.env.example` para `.env` e preencha as variáveis com os valores do app Web:

   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=
   EXPO_PUBLIC_FIREBASE_APP_ID=
   ```

4. No Firebase Console, crie o **Cloud Firestore** em **Firestore Database**. Depois publique as regras deste projeto. Com o Firebase CLI instalado e autenticado:

   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules --project healthcar-e7526
   ```

   Como alternativa, copie o conteúdo de `firestore.rules` na aba **Regras** do Firestore Console e publique.

5. Instale as dependências, reinicie o Expo para carregar o `.env` e abra o app Android:

   ```bash
   npm install
   npx expo start --clear
   ```

6. Para testar, crie uma conta pela tela de cadastro. Em **Authentication > Usuários**, confirme que a conta foi criada. Em **Firestore Database > Dados**, confirme o documento `users/{UID}` e os campos `email`, `displayName` e `vehicle`. Saia em **Configurações > Sair da conta** e entre novamente com o mesmo e-mail e senha.

O Firebase Authentication armazena as contas e credenciais. O perfil e os dados do veículo são gravados no Cloud Firestore e também no armazenamento local do dispositivo. As regras permitem que cada pessoa leia e altere somente o documento associado ao próprio UID. Não versione o arquivo `.env`.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
