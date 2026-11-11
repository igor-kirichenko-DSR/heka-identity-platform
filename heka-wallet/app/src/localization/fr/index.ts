// prettier-ignore
const translation = {
  "Common": {
    "Next": "Suivant",
    "Confirm": "Confirmer",
    "Advanced": "Avancé",
    "CopyToClipboard": "Copier dans le presse-papiers",
    "Available": "Disponible",
    "Send": "Envoyer",
    "Low": "Faible",
    "Average": "Moyen",
    "High": "Élevé",
    "Security": "Sécurité",
    "NotSpecified": "Non spécifié",
    "Scan": "Scanner",
    "Code": "Code",
    "CreateNew": "Créer nouveau",
    "UseExisting": "Utiliser existant"
  },
  "Auth": {
    "Login": "Se connecter"
  },
  "Home": {
    "Credentials": "Certificats",
    "Notifications": "Notifications",
    "Chats": "Chats",
    "CredentialsGuide": "Scannez un QR code spécial pour recevoir et utiliser vos certificats",
    "NotificationsEmpty": "Vous n'avez pas de notifications",
    "ChatsEmpty": "Vous n'avez pas de conversations",
    "AllCredentials": "Tous les certificats"
  },
  "ContactDetails": {
    "RemoveContact": "Supprimer le contact",
    "GoToCredentials": "Aller aux certificats"
  },
  "CredentialDetails": {
    "ShowAll": "Afficher tous les champs",
    "HideAll": "Masquer tous les champs",
    "Remove": "Supprimer"
  },
  "TabStack": {
    "Coins": "Pièces",
    "Payments": "Paiements",
    "Settings": "Paramètres"
  },
  "Passkeys": {
    "PasskeyAuth": "Authentification par clé d'accès",
    "SelectAuthOption": "Veuillez sélectionner une option d'authentification par clé d'accès",
    "AuthenticateWithExisting": "Authentifiez-vous avec une clé d'accès existante",
    "CreateNew": "Créer une nouvelle clé d'accès"
  },
  "WalletBackup": {
    "WalletRestore": "Restaurer le portefeuille",
    "BackupIsAvailable": "La sauvegarde est disponible",
    "BackupIsNotAvailable": "La sauvegarde n'est pas disponible",
    "BackupWallet": "Sauvegarder le portefeuille",
    "BackupingWallet": "Sauvegarde en cours...",
    "RestoreWallet": "Restaurer le portefeuille",
    "UsePasskeyToAuth": "Veuillez utiliser la clé d'accès pour vous authentifier auprès du service de sauvegarde"
  },
  "Crypto": {
    "Title": "Paiements",
    "Explorer": "Voir dans l'explorateur",
    "Wallet": {
      "LoadFailed": "Le portefeuille de paiement n'a pas pu être ouvert.",
      "Retry": "Réessayer"
    },
    "Address": {
      "Copy": "Copier l'adresse",
      "Copied": "Copiée"
    },
    "Register": {
      "Intro": {
        "Title": "Portefeuille de paiement",
        "Text": "Envoyez et recevez des stablecoins comme l'USDC. Créez un nouveau portefeuille ou importez celui que vous avez déjà.",
        "Create": "Créer un nouveau portefeuille",
        "Import": "Importer un portefeuille existant"
      },
      "NewMnemonic": {
        "Title": "Notez votre phrase de récupération",
        "Text1": "Ces 12 mots sont le seul moyen de récupérer vos fonds si vous perdez ce téléphone ou changez de portefeuille.",
        "Text2": "Écrivez-les sur papier et gardez-les en lieu sûr. Ne les partagez jamais et ne les gardez jamais dans une capture d'écran.",
        "Written": "Je l'ai notée"
      },
      "VerifyMnemonic": {
        "Title": "Vérifiez votre phrase de récupération",
        "Text": "Touchez les mots manquants dans le bon ordre.",
        "WrongOrder": "Les mots ne sont pas dans le bon ordre. Touchez un mot pour le retirer, ou recommencez.",
        "Reset": "Recommencer"
      },
      "Done": {
        "Title": "Votre portefeuille est prêt",
        "BackupPrompt": "Sauvegardez le portefeuille maintenant pour que le nouveau portefeuille soit aussi dans votre sauvegarde. Votre phrase de récupération reste la sauvegarde principale.",
        "PhraseIsBackup": "Votre phrase de récupération est votre sauvegarde. Gardez-la en lieu sûr : sans elle, personne ne peut récupérer vos fonds.",
        "RawKeyText": "Gardez votre clé privée en lieu sûr : sans elle, personne ne peut récupérer vos fonds.",
        "BackupNow": "Sauvegarder maintenant",
        "BackupDone": "Sauvegarde terminée.",
        "BackupFailed": "La sauvegarde a échoué. Réessayez plus tard depuis les paramètres.",
        "OpenWallet": "Ouvrir le portefeuille"
      },
      "Errors": {
        "Exists": "Un portefeuille de paiement existe déjà sur cet appareil.",
        "SaveFailed": "Le portefeuille n'a pas pu être enregistré. Réessayez."
      }
    },
    "Import": {
      "Title": "Importer votre portefeuille",
      "Text": "Saisissez votre phrase de récupération de 12 ou 24 mots, ou une clé privée commençant par 0x.",
      "Label": "Phrase de récupération ou clé privée",
      "Submit": "Importer",
      "Errors": {
        "WordCount": "Une phrase de récupération compte 12, 15, 18, 21 ou 24 mots.",
        "InvalidPhrase": "Cette phrase de récupération n'est pas valide.",
        "InvalidKey": "Une clé privée est 0x suivi de 64 caractères hexadécimaux."
      }
    },
    "Home": {
      "Receive": "Recevoir",
      "Send": "Envoyer",
      "History": "Historique",
      "Settings": "Paramètres",
      "NoAccount": "Pas encore de compte sur ce réseau.",
      "BalanceFailed": "Les soldes n'ont pas pu être mis à jour. Tirez vers le bas pour réessayer.",
      "ActivationPending": "Ce compte devient actif avec son premier dépôt.",
      "EnableAsset": "Activer {{symbol}}",
      "EnableAssetConfirm": "Confirmez pour activer le jeton",
      "EnableAssetFailed": "Le jeton n'a pas pu être activé. Réessayez."
    },
    "Receive": {
      "Header": "Recevoir",
      "Title": "Recevoir des {{symbol}} sur {{chain}}",
      "Hint": "N'envoyez à cette adresse que des actifs sur {{chain}}."
    },
    "Send": {
      "Header": "Envoyer",
      "Recipient": "Adresse du destinataire",
      "Scan": "Scanner un code QR",
      "Amount": "Montant ({{symbol}})",
      "Max": "Max",
      "Confirm": "Confirmez le paiement",
      "NewRecipient": "Vous n'avez jamais envoyé à cette adresse. Vérifiez-la attentivement.",
      "AddressWarnings": {
        "no-checksum": "Cette adresse n'a pas de somme de contrôle. Vérifiez-la attentivement."
      },
      "Result": {
        "pending": "Paiement envoyé",
        "success": "Paiement terminé",
        "failed": "Échec du paiement",
        "unknown": "Statut du paiement inconnu",
        "Summary": "{{amount}} à {{to}}"
      },
      "Errors": {
        "InvalidAddress": "Cette adresse n'est pas valide sur ce réseau.",
        "InvalidAmount": "Saisissez un montant valide.",
        "InsufficientAmount": "Le solde est insuffisant pour ce montant.",
        "InsufficientFee": "Le solde est insuffisant pour payer les frais de réseau.",
        "Pending": "Attendez la fin de votre paiement précédent.",
        "Locked": "Le portefeuille est verrouillé. Déverrouillez-le et réessayez.",
        "Failed": "Le paiement n'a pas pu être envoyé."
      }
    },
    "Fee": {
      "Estimate": "Frais de réseau : {{amount}}",
      "UpTo": "Frais de réseau : jusqu'à {{amount}}",
      "Usdc": "Payer les frais en USDC",
      "Failed": "Les frais de réseau n'ont pas pu être estimés.",
      "Warnings": {
        "insufficient-native-balance": "Le solde est insuffisant pour payer les frais de réseau."
      }
    },
    "Status": {
      "pending": "En attente",
      "success": "Terminé",
      "failed": "Échec",
      "unknown": "Inconnu"
    },
    "History": {
      "Header": "Historique",
      "Empty": "Aucun paiement pour le moment.",
      "LoadFailed": "L'historique n'a pas pu être chargé. Tirez vers le bas pour réessayer.",
      "PartialNote": "Les paiements anciens et les transferts entrants de la monnaie propre au réseau peuvent manquer ici.",
      "Direction": {
        "in": "De {{address}}",
        "out": "À {{address}}",
        "self": "À vous-même"
      }
    },
    "Scan": {
      "Header": "Scanner",
      "NotAnAddress": "Ce code QR ne contient pas d'adresse.",
      "Unsupported": "Cette demande de paiement concerne un autre réseau ou un autre jeton."
    },
    "Settings": {
      "Header": "Paramètres de paiement",
      "DefaultChain": "Réseau par défaut",
      "SaveFailed": "Le réseau par défaut n'a pas pu être enregistré.",
      "RevealPhrase": "Afficher la phrase de récupération",
      "RemoveWallet": "Supprimer le portefeuille de paiement"
    },
    "Reveal": {
      "Header": "Phrase de récupération",
      "Title": "Votre phrase de récupération",
      "Warning": "Toute personne qui connaît ces mots peut prendre vos fonds. Ne les partagez pas et ne faites pas de capture d'écran.",
      "Confirm": "Confirmez pour afficher la phrase de récupération",
      "Failed": "La phrase de récupération n'a pas pu être affichée."
    },
    "Remove": {
      "Header": "Supprimer le portefeuille",
      "Title": "Supprimer le portefeuille de paiement ?",
      "Warning": "Le portefeuille de paiement sera supprimé de cet appareil. Sans votre phrase de récupération, ces fonds ne pourront pas être récupérés. Vos attestations ne sont pas concernées.",
      "Confirm": "Confirmez pour supprimer le portefeuille de paiement",
      "Submit": "Supprimer",
      "Failed": "Le portefeuille n'a pas pu être supprimé."
    }
  },
  "Biometry": {
    "Biometrics": "Biométrie",
    "Enable": "Activer la biométrie",
    "Toggle": "Basculer la biométrie",
    "EnabledText1": "Connectez-vous avec la biométrie de votre téléphone plutôt qu'avec le code PIN de votre portefeuille. Cela signifie que toutes les données d'empreintes digitales et faciales ajoutées sur ce téléphone peuvent être utilisées pour accéder à votre application Heka Wallet.",
    "EnabledText2": "Assurez-vous que seul vous pouvez accéder à votre application Heka Wallet.",
    "Warning": "Assurez-vous que seul vous pouvez accéder à votre application Heka Wallet.",
    "UseToUnlock": "Utiliser la biométrie pour déverrouiller l'application",
    "Skip": "Passer",
    "EnabledTitle": "Autoriser l'utilisation de la biométrie",
    "EnabledDescription": "Configurez la biométrie dans les paramètres du dispositif",
    "OpenSettings": "Ouvrir les paramètres"
  },
  "Connection": {
    "MakingConnection": "Établir une connexion sécurisée.",
    "UnknownConnection": "Connexion inconnue"
  },
  "ConnectionDetails": {
    "Rename": "Renommer",
    "Delete": "Supprimer"
  },
  "Contacts": {
    "TypeHere": "Message"
  },
  "Credentials": {
    "Credential": "Certificat",
    "Issuer": "Émetteur",
    "AddCredential": "Ajouter un certificat",
    "EmptyList": "Votre portefeuille est vide.",
    "LoadFailed": "Certains certificats n'ont pas pu être chargés.",
    "AddFirstCredential": "Ajoutez votre premier certificat",
    "UnknownIssuer": "Émetteur inconnu",
    "UnknownVerifier": "Vérificateur inconnu"
  },
  "CredentialOffer": {
    "EnterCredentialPIN": "Veuillez saisir le code PIN du certificat",
    "CredentialAddedToYourWallet": "Votre certificat est prête à être utilisée.",
    "CredentialOnTheWay": "Votre certificat est en route.",
    "IssuedBy": "Émis par"
  },
  "ProofRequest": {
    "RequestedInformation": "Informations demandées",
    "PresentationOnTheWay": "Votre présentation est en route.",
    "PresentationAccepted": "Vous êtes dans ! \nVotre preuve de présentation a été acceptée."
  },
  "Notifications": {
    "CredentialOffer": "Offre de certificat",
    "Credential": "Certificat",
    "ProofRequest": "Demande de preuve",
    "ProofPresentation": "Présentation de preuve",
    "CredentialRevoked": "Certificat révoqué",
    "Received": "Reçu",
    "Requested": "Demandé",
    "Sent": "Envoyé",
    "Accepted": "Accepté",
    "Declined": "Refusé"
  },
  "Onboarding": {
    "Welcome": "Bienvenue",
    "WelcomeParagraph1": "L'application Heka Wallet vous permet de recevoir, stocker et utiliser des certificats numériques.",
    "WelcomeParagraph2": "Elle est hautement sécurisée et aide à protéger votre vie privée en ligne.",
    "StoredSecurelyTitle": "Certificats numériques, stockés en toute sécurité",
    "StoredSecurelyBody": "Heka Wallet stocke des certificats numériques — les versions numériques de documents tels que permis, identités, autorisations, ordonnances médicales, etc. Ils sont stockés de manière sécurisée, uniquement sur cet appareil.",
    "UsingCredentialsTitle": "Recevoir et utiliser des certificats",
    "UsingCredentialsBody": "Pour recevoir et utiliser des certificats, utilisez la fonction « Scanner » dans l'application pour scanner un QR code spécial. Les informations sont échangées via une connexion privée et cryptée.",
    "PaymentsTitle": "Paiements, séparés",
    "PaymentsBody": "L’application Heka Wallet peut aussi contenir un portefeuille de paiement pour les réseaux de test. C’est facultatif, et ses clés ne quittent jamais cet appareil. Les attestations et les paiements ne partagent aucune information.",
    "PrivacyConfidentiality": "Confidentialité et protection de la vie privée",
    "PrivacyParagraph": "Vous autorisez chaque utilisation des informations de votre application Heka Wallet. Vous ne partagez que ce qui est nécessaire pour une situation donnée. L'administration de l'application ou des tiers ne sont pas informés de l'utilisation de vos certificats numériques.",
    "GetStarted": "Commencer",
    "SkipA11y": "Passer l'introduction",
    "AlreadyHaveAWallet": "Vous avez déjà un portefeuille sauvegardé ?",
    "UseWalletRecovery": "Utiliser la récupération du portefeuille",
    "RestoreWallet": "Restaurer le portefeuille"
  },
  "Screens": {
    "Onboarding": "Heka Wallet"
  },
  "NetInfo": {
    "NoInternetConnectionTitle": "Pas de connexion Internet",
    "NoInternetConnectionMessage": "Vous ne pouvez pas accéder aux services via Heka Wallet ni recevoir de certificats tant que vous n'êtes pas reconnecté.\n\nVeuillez vérifier votre connexion Internet."
  },
  "CameraDisclosure": {
    "AllowCameraUse": "Autoriser l'utilisation de la caméra",
    "CameraDisclosure": "La caméra est utilisée pour scanner des QR codes qui initient une offre ou une demande de certificat. Aucune information sur les images n'est stockée, utilisée pour l'analyse ou partagée.",
    "ToContinueUsing": "Pour continuer à utiliser la fonction de scan de Heka Wallet, veuillez autoriser les permissions de la caméra.",
    "Allow": "Autoriser",
    "OpenSettings": "Ouvrir les paramètres"
  },
  "Scan": {
    "ScanOnySpecial": "Seuls des QR codes spécifiques peuvent être scannés par Heka Wallet.",
    "ScanOnlySpecial3": "Heka Wallet ne prend actuellement pas en charge l'ajout de certificats numériques en scannant ou en prenant des photos de documents physiques.",
    "WhereToUseLink": "Voir où vous pouvez utiliser Heka Wallet",
    "BadQRCodeDescription": "Le QR code scanné n'est pas compatible avec Heka Wallet. Heka Wallet fonctionne uniquement avec des services participants.\n\nIl ne peut pas ajouter de certificats numériques en prenant des photos de documents physiques."
  },
  "Settings": {
    "PoweredBy": "Propulsé par",
    "WhatAreContacts": "Que sont les contacts ?",
    "AppSettings": "Paramètres de l'application",
    "Account": "Compte",
    "Troubleshoot": "Dépannage",
    "ShareLogs": "Partager les journaux",
    "Information": "Informations",
    "Terms": "Conditions d'utilisation",
    "Introduction": "Introduction",
    "UserProfile": "Profil utilisateur",
    "DeleteMyAccount": "Supprimer mon compte",
    "DataManagement": "Gestion des données",
    "ProximityPresentation": "Présentation en proximité",
    "Logs": "Journaux"
  },
  "UserProfile": {
    "UserId": "ID utilisateur",
    "Name": "Nom",
    "Email": "Email",
    "NoConnectionInfoText": "Pas de connexion Internet - les données peuvent être obsolètes"
  },
  "Developer": {
    "Environment": "Environnement",
    "Production": "Production",
    "Development": "Développement",
    "Test": "Test",
    "DeveloperMode": "Mode développeur",
    "Toggle": "Basculer le mode développeur"
  },
  "ItemsList": {
    "Empty": "Aucun élément"
  },
  "Loading": {
    "GoBack": "Retourner en arrière"
  },
  "Global": {
    "Accept": "Accepter",
    "Decline": "Refuser",
    "YesDecline": "Oui, refuser",
    "DontDecline": "Ne pas refuser",
    "DontRemove": "Ne pas supprimer",
    "Done": "Terminé",
    "Continue": "Continuer"
  },
  "PINCreate": {
    "CreatePinTitle": "Créer un code PIN",
    "CreatePinText": "Créez un code PIN pour sécuriser votre portefeuille. Si vous l'oubliez, vous devrez peut-être reconfigurer votre portefeuille et réajouter vos certificats.",
    "ReEnterPinTitle": "Saisir à nouveau le code PIN",
    "ReEnterPinText": "Saisissez à nouveau un code PIN pour sécuriser votre portefeuille. Si vous l'oubliez, vous devrez peut-être reconfigurer votre portefeuille et réajouter vos certificats.",
    "EnterOldPinTitle": "Entrez votre ancien code PIN",
    "EnterOldPinText": "Entrez votre code PIN actuel pour continuer. Si vous l'oubliez, vous devrez peut-être reconfigurer votre portefeuille et réajouter vos certificats.",
    "EnterNewPinTitle": "Entrez un nouveau code PIN",
    "EnterNewPinText": "Choisissez un nouveau code PIN pour votre portefeuille. Assurez-vous qu'il s'agisse de quelque chose dont vous vous souviendrez. Si vous l'oubliez, vous devrez peut-être reconfigurer votre portefeuille et réajouter vos certificats.",
    "ReEnterNewPinTitle": "Confirmez le nouveau code PIN",
    "ReEnterNewPinText": "Veuillez confirmer le nouveau code PIN pour sécuriser votre portefeuille. Si vous l'oubliez, vous devrez peut-être reconfigurer votre portefeuille et réajouter vos certificats."
  },
  "PINEnter": {
    "EnterPIN": "Entrez le code PIN de votre portefeuille"
  },
  "PINConfirmation": {
    "Label": "Mot de passe",
    "Invalid": "Mot de passe invalide"
  },
  "Proof": {
    "SharedInformation": "Informations partagées"
  },
  "Chat": {
    "YouConnected": "Vous êtes connecté avec",
    "CredentialProposalSent": "A envoyé une proposition de certificat",
    "CredentialOfferReceived": "A envoyé une offre de certificat",
    "CredentialRequestSent": "A envoyé une demande de certificat",
    "CredentialDeclined": "A refusé une offre de certificat",
    "CredentialReceived": "A reçu un certificat",
    "ProofRequestSent": "A envoyé une demande de preuve",
    "ProofPresentationReceived": "Vous a envoyé des informations",
    "ProofRequestReceived": "A reçu une demande de preuve",
    "ProofRequestRejected": "A rejeté une demande de preuve",
    "ProofRequestRejectReceived": "A rejeté une demande de preuve",
    "ProofRequestSatisfied": "A partagé des informations"
  },
  "DigitalCredentials": {
    "EnterPinToShare": "Saisissez votre code PIN pour partager un certificat",
    "SharingWith": "Partage avec {{origin}}",
    "IncorrectPin": "Code PIN incorrect. Veuillez réessayer.",
    "Cancel": "Annuler",
    "CredentialTitleFallback": "Certificat",
    "IssuedBy": "Émis par {{issuer}}",
    "UnknownIssuer": "Émetteur inconnu"
  }
}

export default translation
