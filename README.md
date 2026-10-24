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
3. A configuração do app Web do projeto já está definida como padrão no app, portanto o APK compilado funciona sem `.env` ou variáveis cadastradas no EAS. Se precisar usar outro app Firebase durante o desenvolvimento local, copie `.env.example` para `.env` e preencha as variáveis para substituir esses padrões:

   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=
   EXPO_PUBLIC_FIREBASE_APP_ID=
   ```

   Esses valores de configuração do Firebase são incluídos no bundle do app e não são senhas. Proteja os dados usando as regras do Firestore e as configurações de Authentication do Firebase; nunca coloque credenciais privadas em variáveis `EXPO_PUBLIC_`.

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

   Para gerar o APK de teste, use `eas build --platform android --profile preview`. A configuração Firebase padrão já será incluída mesmo sem variáveis configuradas no ambiente do EAS.

6. Para testar em aparelho, crie uma conta pela tela de cadastro. Em **Authentication > Usuários**, confirme que a conta foi criada. No Firestore, os dados ficam sob `users/{UID}`: o documento da conta, `vehicles/{vehicleId}` e subcoleções de viagens, manutenções, abastecimentos, falhas e blocos de telemetria. A tela **Configurações > Sincronização** mostra a fila pendente e permite solicitar uma sincronização.
7. Com a conta conectada, registre uma manutenção e um abastecimento; depois faça uma leitura OBD para gerar viagem, telemetria ou falhas. Desative a internet e continue usando o app: os registros devem permanecer disponíveis no SQLite. Reative a rede e aguarde a fila sincronizar. Por fim, entre com a mesma conta em outro aparelho para conferir a restauração dos registros.

O SQLite é a base usada pelo app durante o uso. Cada registro local pertence ao UID autenticado e grava uma entrada na fila de sincronização; quando a rede está disponível, a fila é enviada ao Firestore e os dados da conta são restaurados no aparelho. A sessão do Firebase Auth identifica a conta, mas a operação offline continua disponível no aparelho que já contém os dados locais. As regras Firestore deste repositório limitam a leitura e gravação ao UID autenticado e devem ser publicadas no projeto Firebase antes do teste. Não versione o arquivo `.env`.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
