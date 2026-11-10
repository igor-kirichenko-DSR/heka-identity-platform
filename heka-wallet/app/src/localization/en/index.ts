// prettier-ignore
const translation = {
  "Common": {
    "Next": "Next",
    "Confirm": "Confirm",
    "Advanced": "Advanced",
    "CopyToClipboard": "Copy to clipboard",
    "Available": "Available",
    "Send": "Send",
    "Low": "Low",
    "Average": "Average",
    "High": "High",
    "Security": "Security",
    "NotSpecified": "Not specified",
    "Scan": "Scan",
    "Code": "Code",
    "CreateNew": "Create new",
    "UseExisting": "Use Existing"
  },
  "Auth": {
    "Login": "Login"
  },
  "Home": {
    "Credentials": "Credentials",
    "Notifications": "Notifications",
    "Chats": "Chats",
    "CredentialsGuide": "Scan a special QR code to receive and use credentials",
    "NotificationsEmpty": "You don't have notifications",
    "ChatsEmpty": "You don't have chats",
    "AllCredentials": "All credentials"
  },
  "ContactDetails": {
    "RemoveContact": "Remove contact",
    "GoToCredentials": "Go to credentials"
  },
  "CredentialDetails" : {
    "ShowAll": "Show all fields",
    "HideAll": "Hide all fields",
    "Remove": "Remove",
  },
  "TabStack": {
    "Coins": "Coins",
    "Settings": "Settings"
  },
  "Passkeys": {
    "PasskeyAuth": "Passkey authentication",
    "SelectAuthOption": "Please select passkey authentication option",
    "AuthenticateWithExisting": "Authenticate with existing passkey",
    "CreateNew": "Create new passkey"
  },
  "WalletBackup" : {
    "WalletRestore": "Wallet restore",
    "BackupIsAvailable": "Backup is available",
    "BackupIsNotAvailable": "Backup is not available",
    "BackupWallet": "Backup wallet",
    "BackupingWallet": "Backuping...",
    "RestoreWallet": "Restore wallet",
    "UsePasskeyToAuth": "Please use passkey to authenticate with backup service"
  },
  "Crypto": {
    "Title": "Payments",
    "Explorer": "View in explorer",
    "Wallet": {
      "LoadFailed": "The payment wallet could not be opened.",
      "Retry": "Try again"
    },
    "Address": {
      "Copy": "Copy address",
      "Copied": "Copied"
    },
    "Register": {
      "Intro": {
        "Title": "Payment wallet",
        "Text": "Send and receive stablecoins such as USDC. Create a new wallet or import one you already have.",
        "Create": "Create new wallet",
        "Import": "Import existing wallet"
      },
      "NewMnemonic": {
        "Title": "Write down your recovery phrase",
        "Text1": "These 12 words are the only way to recover your funds if you lose this phone or move to another wallet.",
        "Text2": "Write them on paper and keep them safe. Never share them and never store them in a screenshot.",
        "Written": "I have written it down"
      },
      "VerifyMnemonic": {
        "Title": "Check your recovery phrase",
        "Text": "Tap the missing words in the right order.",
        "WrongOrder": "The words are not in the right order. Tap a word to take it back, or reset.",
        "Reset": "Start over"
      },
      "Done": {
        "Title": "Your wallet is ready",
        "BackupPrompt": "Back up the wallet now, so the new wallet is in your backup too. Your recovery phrase stays the main backup.",
        "PhraseIsBackup": "Your recovery phrase is your backup. Keep it safe: without it, nobody can recover your funds.",
        "RawKeyText": "Keep your private key safe: without it, nobody can recover your funds.",
        "BackupNow": "Back up now",
        "BackupDone": "Backup complete.",
        "BackupFailed": "The backup failed. Try again later from Settings.",
        "OpenWallet": "Open wallet"
      },
      "Errors": {
        "Exists": "A payment wallet already exists on this device.",
        "SaveFailed": "The wallet could not be saved. Try again."
      }
    },
    "Import": {
      "Title": "Import your wallet",
      "Text": "Enter your 12 or 24-word recovery phrase, or a private key that starts with 0x.",
      "Label": "Recovery phrase or private key",
      "Submit": "Import",
      "Errors": {
        "WordCount": "A recovery phrase has 12, 15, 18, 21 or 24 words.",
        "InvalidPhrase": "This recovery phrase is not valid.",
        "InvalidKey": "A private key is 0x followed by 64 hexadecimal characters."
      }
    },
    "Home": {
      "Receive": "Receive",
      "Send": "Send",
      "History": "History",
      "Settings": "Settings",
      "NoAccount": "No account on this network yet.",
      "BalanceFailed": "Balances could not be updated. Pull down to try again.",
      "ActivationPending": "This account becomes active with its first deposit.",
      "EnableAsset": "Enable {{symbol}}",
      "EnableAssetConfirm": "Confirm to enable the token",
      "EnableAssetFailed": "The token could not be enabled. Try again."
    },
    "Receive": {
      "Header": "Receive",
      "Title": "Receive {{symbol}} on {{chain}}",
      "Hint": "Only send assets on {{chain}} to this address."
    },
    "Send": {
      "Header": "Send",
      "Recipient": "Recipient address",
      "Scan": "Scan a QR code",
      "Amount": "Amount ({{symbol}})",
      "Max": "Max",
      "Confirm": "Confirm the payment",
      "NewRecipient": "You have not sent to this address before. Check it carefully.",
      "AddressWarnings": {
        "no-checksum": "This address has no checksum. Check it carefully."
      },
      "Result": {
        "pending": "Payment sent",
        "success": "Payment complete",
        "failed": "Payment failed",
        "unknown": "Payment status unknown",
        "Summary": "{{amount}} to {{to}}"
      },
      "Errors": {
        "InvalidAddress": "This is not a valid address on this network.",
        "InvalidAmount": "Enter a valid amount.",
        "InsufficientAmount": "The balance is too low for this amount.",
        "InsufficientFee": "The balance is too low to pay the network fee.",
        "Pending": "Wait until your previous payment is complete.",
        "Locked": "The wallet is locked. Unlock it and try again.",
        "Failed": "The payment could not be sent."
      }
    },
    "Fee": {
      "Estimate": "Network fee: {{amount}}",
      "UpTo": "Network fee: up to {{amount}}",
      "Usdc": "Pay fee in USDC",
      "Failed": "The network fee could not be estimated.",
      "Warnings": {
        "insufficient-native-balance": "The balance is too low to pay the network fee."
      }
    },
    "Status": {
      "pending": "Pending",
      "success": "Complete",
      "failed": "Failed",
      "unknown": "Unknown"
    },
    "History": {
      "Header": "History",
      "Empty": "No payments yet.",
      "LoadFailed": "History could not be loaded. Pull down to try again.",
      "PartialNote": "Older payments and incoming transfers of the network's own coin may be missing here.",
      "Direction": {
        "in": "From {{address}}",
        "out": "To {{address}}",
        "self": "To yourself"
      }
    },
    "Scan": {
      "Header": "Scan",
      "NotAnAddress": "This QR code does not contain an address.",
      "Unsupported": "This payment request is for another network or token."
    },
    "Settings": {
      "Header": "Payment settings",
      "DefaultChain": "Default network",
      "SaveFailed": "The default network could not be saved.",
      "RevealPhrase": "Show recovery phrase",
      "RemoveWallet": "Remove payment wallet"
    },
    "Reveal": {
      "Header": "Recovery phrase",
      "Title": "Your recovery phrase",
      "Warning": "Anyone with these words can take your funds. Do not share them and do not take a screenshot.",
      "Confirm": "Confirm to show the recovery phrase",
      "Failed": "The recovery phrase could not be shown."
    },
    "Remove": {
      "Header": "Remove wallet",
      "Title": "Remove the payment wallet?",
      "Warning": "This removes the payment wallet from this device. Without your recovery phrase, these funds cannot be recovered. Your credentials are not affected.",
      "Confirm": "Confirm to remove the payment wallet",
      "Submit": "Remove",
      "Failed": "The wallet could not be removed."
    }
  },
  "Biometry": {
    "Biometrics": "Biometrics",
    "Enable": "Enable Biometrics",
    "Toggle": "Toggle Biometrics",
    "EnabledText1": "Log in with your phone's biometrics instead of your wallet PIN. This means all fingerprint and facial data added on this phone can be used to access your Heka Wallet App.",
    "EnabledText2": "Ensure only you have access to your Heka Wallet App.",
    "Warning": "Ensure only you have access to your Heka Wallet App.",
    "UseToUnlock": "Use biometrics to unlock the app",
    "Skip": "Skip",
    "EnabledTitle": "Biometrics use",
    "EnabledDescription": "You need to set up biometrics in the device settings first and then you will be able to enable it for accessing Heka Wallet App.",
    "OpenSettings": "Open settings"
  },
  "Connection": {
    "MakingConnection": "Make a secure connection.",
    "UnknownConnection": "Unknown Connection"
  },
  "ConnectionDetails": {
    "Rename": "Rename",
    "Delete": "Delete",
  },
  "Contacts": {
    "TypeHere": "Message"
  },
  "Credentials": {
    "Credential": "Credential",
    "Issuer": "Issuer",
    "AddCredential": "Add Credential",
    "EmptyList": "Your wallet is empty.",
    "LoadFailed": "Some credentials could not be loaded.",
    "AddFirstCredential": "Add your first credential",
    "UnknownIssuer": "Unknown issuer",
    "UnknownVerifier": "Unknown verifier"
  },
  "CredentialOffer": {
    "EnterCredentialPIN": "Please enter credential PIN",
    "CredentialAddedToYourWallet": "Your credential is ready to go.",
    "CredentialOnTheWay": "Your credential is on the way.",
    "IssuedBy": "Issued by"
  },
  "ProofRequest": {
    "RequestedInformation": "Requested information",
    "PresentationOnTheWay": "Your presentation is on the way.",
    "PresentationAccepted": "You're in! \nYour credential proof has been accepted.",
  },
  "Notifications": {
    "CredentialOffer": "Credential offer",
    "Credential": "Credential",
    "ProofRequest": "Proof request",
    "ProofPresentation": "Proof presentation",
    "CredentialRevoked": "Credential revoked",
    "Received": "Received",
    "Requested": "Requested",
    "Sent": "Sent",
    "Accepted": "Accepted",
    "Declined": "Declined",
  },
  "Onboarding": {
    "Welcome": "Welcome",
    "WelcomeParagraph1": "Heka Wallet App allows you to receive, store and use digital credentials.",
    "WelcomeParagraph2": "It is highly secure, and helps protect your privacy online.",
    "StoredSecurelyTitle": "Digital credentials, stored securely",
    "StoredSecurelyBody": "Heka Wallet App holds digital credentials — the digital versions of things like licenses, identities, permits, medical prescriptions and etc. They are stored securely, only on this device.",
    "UsingCredentialsTitle": "Receiving and using credentials",
    "UsingCredentialsBody": "To receive and use credentials you use the “Scan” feature in the app to scan a special QR code. Information is sent and received over a private, encrypted connection.",
    "PrivacyConfidentiality": "Privacy and confidentiality",
    "PrivacyParagraph": "You approve every use of information from your Heka Wallet App. You also only share what is needed for a situation. App administration or other third parties are not informed on when and how you use your digital credentials.",
    "GetStarted": "Get Started",
    "SkipA11y": "Skip introduction",
    "AlreadyHaveAWallet": "Already have a backed-up wallet?",
    "UseWalletRecovery": "Use wallet recovery",
    "RestoreWallet": "Restore wallet"
  },
  "Screens": {
    "Onboarding": "Heka Wallet",
  },
  "NetInfo": {
    "NoInternetConnectionTitle": "No internet connection",
    "NoInternetConnectionMessage": "You're unable to access services using Heka Wallet or receive credentials until you're back online.\n\nPlease check your internet connection."
  },
  "CameraDisclosure": {
    "AllowCameraUse": "Allow camera use",
    "CameraDisclosure": "The camera is used to scan QR codes that initiate a credential offer or credential request. No information about the images is stored, used for analytics, or shared.",
    "ToContinueUsing": "To continue using the Heka Wallet scan feature, please allow camera permissions.",
    "Allow": "Allow",
    "OpenSettings": "Open settings",
  },
  "Scan": {
    "ScanOnySpecial": "Only specific QR codes can be scanned by Heka Wallet.",
    "ScanOnlySpecial3": "Heka Wallet currently doesn't support adding digital credential by scanning or taking photos of physical ones.",
    "WhereToUseLink": "See where you can use Heka Wallet",
    "BadQRCodeDescription": "Ths QR code scanned doesn't work with Heka Wallet. Heka Wallet only works with participating services.\n\nIt currently can't add digital credentials by taking photos of physical ones."
  },
  "Settings": {
    "PoweredBy": "Powered by",
    "WhatAreContacts": "What are contacts?",
    "AppSettings": "App settings",
    "Account": "Account",
    "Troubleshoot": "Troubleshoot",
    "ShareLogs": "Share logs",
    "Information": "Information",
    "Terms": "Terms of use",
    "Introduction": "Introduction",
    "UserProfile": "User profile",
    "DeleteMyAccount": "Delete My Account",
    "DataManagement": "Data management",
    "ProximityPresentation": "Proximity presentation",
    "Logs": "Logs"
  },
  "UserProfile": {
    "UserId": "User ID",
    "Name": "Name",
    "Email": "Email",
    "NoConnectionInfoText": "No internet connection - data may be outdated"
  },
  "Developer": {
    "Environment": "Environment",
    "Production": "Production",
    "Development": "Development",
    "Test": "Test",
    "DeveloperMode": "Developer mode",
    "Toggle": "Toggle Developer Mode"
  },
  "ItemsList": {
    "Empty": "No items"
  },
  "Loading": {
    "GoBack": "Go back"
  },
  "Global": {
    "Accept": "Accept",
    "Decline": "Decline",
    "YesDecline": "Yes, decline",
    "DontDecline": "Don't decline",
    "DontRemove": "Don't remove",
    "Done": "Done",
    "Continue": "Continue"
  },
  "PINCreate": {
    "CreatePinTitle": "Create a PIN",
    "CreatePinText": "Create a PIN to secure your wallet. If you forget it, you may need to set up your wallet again and re-add your credentials.",
    "ReEnterPinTitle": "Re-enter PIN",
    "ReEnterPinText": "Re-enter a PIN to secure your wallet. If you forget it, you may need to set up your wallet again and re-add your credentials.",
    "EnterOldPinTitle": "Enter your old PIN",
    "EnterOldPinText": "Enter your current PIN to continue. If you forget this PIN, you may need to set up your wallet again and re-add your credentials.",
    "EnterNewPinTitle": "Enter a new PIN",
    "EnterNewPinText": "Choose a new PIN for your wallet. Make sure it's something you'll remember. If you forget it, you may need to set up your wallet again and re-add your credentials.",
    "ReEnterNewPinTitle": "Re-enter the new PIN",
    "ReEnterNewPinText": "Please confirm the new PIN to secure your wallet. If you forget it, you may need to set up your wallet again and re-add your credentials.",
  },
  "PINEnter": {
    "EnterPIN": "Enter your wallet PIN"
  },
  "PINConfirmation": {
    "Label": "Password",
    "Invalid": "Invalid password"
  },
  "Proof": {
    "SharedInformation": "Shared Information"
  },
  "Chat": {
    "YouConnected": "You connected with",
    "CredentialProposalSent": "Sent a credential proposal",
    "CredentialOfferReceived": "Sent a credential offer",
    "CredentialRequestSent": "Sent a credential request",
    "CredentialDeclined": "Declined a credential offer",
    "CredentialReceived": "Received a credential",
    "ProofRequestSent": "Sent a proof request",
    "ProofPresentationReceived": "Has sent you information",
    "ProofRequestReceived": "Received a proof request",
    "ProofRequestRejected": "Rejected a proof request",
    "ProofRequestRejectReceived": "Rejected a proof request",
    "ProofRequestSatisfied": "Shared information",
  },
  "DigitalCredentials": {
    "EnterPinToShare": "Enter your PIN to share a credential",
    "SharingWith": "Sharing with {{origin}}",
    "IncorrectPin": "Incorrect PIN. Please try again.",
    "Cancel": "Cancel",
    "CredentialTitleFallback": "Credential",
    "IssuedBy": "Issued by {{issuer}}",
    "UnknownIssuer": "Unknown issuer"
  }
}

export default translation
