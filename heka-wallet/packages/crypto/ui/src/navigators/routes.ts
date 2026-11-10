// Prefixed so the names cannot clash with the app's own routes once CryptoStack is nested in a tab (F06).
export enum CryptoStacks {
  Register = 'CryptoRegister',
  Main = 'CryptoMain',
}

export enum CryptoScreens {
  RegisterIntro = 'CryptoRegisterIntro',
  NewMnemonic = 'CryptoNewMnemonic',
  VerifyMnemonic = 'CryptoVerifyMnemonic',
  ImportWallet = 'CryptoImportWallet',
  RegisterDone = 'CryptoRegisterDone',
  Home = 'CryptoHome',
  Receive = 'CryptoReceive',
  Send = 'CryptoSend',
  ScanAddress = 'CryptoScanAddress',
  History = 'CryptoHistory',
  Settings = 'CryptoSettings',
  RevealPhrase = 'CryptoRevealPhrase',
  RemoveWallet = 'CryptoRemoveWallet',
}
