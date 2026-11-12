// prettier-ignore
const translation = {
  "Common": {
    "Next": "Próximo",
    "Confirm": "Confirmar",
    "Advanced": "Avançado",
    "CopyToClipboard": "Copiar para a área de transferência",
    "Available": "Disponível",
    "Send": "Enviar",
    "Low": "Baixo",
    "Average": "Médio",
    "High": "Alto",
    "Security": "Segurança",
    "NotSpecified": "Não especificado",
    "Scan": "Escanear",
    "Code": "Código",
    "CreateNew": "Criar novo",
    "UseExisting": "Usar existente"
  },
  "Auth": {
    "Login": "Entrar"
  },
  "Home": {
    "Credentials": "Credenciais",
    "Notifications": "Notificações",
    "Chats": "Chats",
    "CredentialsGuide": "Escaneie um código QR especial para receber e usar credenciais",
    "NotificationsEmpty": "Você não tem notificações",
    "ChatsEmpty": "Você não tem conversas",
    "AllCredentials": "Todas as credenciais"
  },
  "ContactDetails": {
    "RemoveContact": "Remover contato",
    "GoToCredentials": "Ir para as credenciais"
  },
  "CredentialDetails": {
    "ShowAll": "Mostrar todos os campos",
    "HideAll": "Ocultar todos os campos",
    "Remove": "Remover"
  },
  "TabStack": {
    "Coins": "Moedas",
    "Payments": "Pagamentos",
    "Settings": "Configurações"
  },
  "Passkeys": {
    "PasskeyAuth": "Autenticação por chave de acesso",
    "SelectAuthOption": "Por favor, selecione a opção de autenticação por chave de acesso",
    "AuthenticateWithExisting": "Autenticar com chave de acesso existente",
    "CreateNew": "Criar nova chave de acesso"
  },
  "WalletBackup": {
    "WalletRestore": "Restaurar carteira",
    "BackupIsAvailable": "Backup disponível",
    "BackupIsNotAvailable": "Backup não disponível",
    "BackupWallet": "Fazer backup da carteira",
    "BackupingWallet": "Realizando backup...",
    "RestoreWallet": "Restaurar carteira",
    "UsePasskeyToAuth": "Por favor, use a chave de acesso para autenticar com o serviço de backup"
  },
  "Crypto": {
    "Title": "Pagamentos",
    "Explorer": "Ver no explorador",
    "Wallet": {
      "LoadFailed": "Não foi possível abrir a carteira de pagamentos.",
      "Retry": "Tentar de novo"
    },
    "Address": {
      "Copy": "Copiar endereço",
      "Copied": "Copiado"
    },
    "Register": {
      "Intro": {
        "Title": "Carteira de pagamentos",
        "Text": "Envie e receba stablecoins como USDC. Crie uma nova carteira ou importe uma que você já tem.",
        "Create": "Criar nova carteira",
        "Import": "Importar carteira existente"
      },
      "NewMnemonic": {
        "Title": "Anote sua frase de recuperação",
        "Text1": "Estas 12 palavras são a única forma de recuperar seus fundos se você perder este celular ou mudar de carteira.",
        "Text2": "Escreva-as em papel e guarde-as em local seguro. Nunca as compartilhe e nunca as guarde em uma captura de tela.",
        "Written": "Já anotei"
      },
      "VerifyMnemonic": {
        "Title": "Confira sua frase de recuperação",
        "Text": "Toque nas palavras que faltam na ordem certa.",
        "WrongOrder": "As palavras não estão na ordem certa. Toque em uma palavra para retirá-la ou recomece.",
        "Reset": "Recomeçar"
      },
      "Done": {
        "Title": "Sua carteira está pronta",
        "BackupPrompt": "Faça o backup agora para que a nova carteira também esteja no seu backup. Sua frase de recuperação continua sendo o backup principal.",
        "PhraseIsBackup": "Sua frase de recuperação é o seu backup. Guarde-a em local seguro: sem ela, ninguém pode recuperar seus fundos.",
        "RawKeyText": "Guarde sua chave privada em local seguro: sem ela, ninguém pode recuperar seus fundos.",
        "BackupNow": "Fazer backup agora",
        "BackupDone": "Backup concluído.",
        "BackupFailed": "O backup falhou. Tente de novo mais tarde nas configurações.",
        "OpenWallet": "Abrir carteira"
      },
      "Errors": {
        "Exists": "Já existe uma carteira de pagamentos neste dispositivo.",
        "SaveFailed": "Não foi possível salvar a carteira. Tente de novo."
      }
    },
    "Import": {
      "Title": "Importar sua carteira",
      "Text": "Digite sua frase de recuperação de 12 ou 24 palavras, ou uma chave privada que começa com 0x.",
      "Label": "Frase de recuperação ou chave privada",
      "Submit": "Importar",
      "Errors": {
        "WordCount": "Uma frase de recuperação tem 12, 15, 18, 21 ou 24 palavras.",
        "InvalidPhrase": "Esta frase de recuperação não é válida.",
        "InvalidKey": "Uma chave privada é 0x seguido de 64 caracteres hexadecimais."
      }
    },
    "Home": {
      "Receive": "Receber",
      "Send": "Enviar",
      "History": "Histórico",
      "Settings": "Configurações",
      "NoAccount": "Ainda não há conta nesta rede.",
      "Balance": "Saldo",
      "BalanceFailed": "Não foi possível atualizar os saldos. Puxe para baixo para tentar de novo.",
      "ActivationPending": "Esta conta fica ativa com o primeiro depósito.",
      "EnableAsset": "Ativar {{symbol}}",
      "EnableAssetConfirm": "Confirme para ativar o token",
      "EnableAssetFailed": "Não foi possível ativar o token. Tente de novo."
    },
    "Receive": {
      "Header": "Receber",
      "Title": "Receber {{symbol}} na {{chain}}",
      "Hint": "Envie para este endereço somente ativos da {{chain}}."
    },
    "Send": {
      "Header": "Enviar",
      "Recipient": "Endereço do destinatário",
      "Scan": "Ler um código QR",
      "Amount": "Valor ({{symbol}})",
      "Max": "Máx.",
      "Confirm": "Confirme o pagamento",
      "NewRecipient": "Você nunca enviou para este endereço. Confira com atenção.",
      "AddressWarnings": {
        "no-checksum": "Este endereço não tem soma de verificação. Confira com atenção."
      },
      "Result": {
        "pending": "Pagamento enviado",
        "success": "Pagamento concluído",
        "failed": "Falha no pagamento",
        "unknown": "Status do pagamento desconhecido",
        "Summary": "{{amount}} para {{to}}"
      },
      "Errors": {
        "InvalidAddress": "Este endereço não é válido nesta rede.",
        "InvalidAmount": "Digite um valor válido.",
        "InsufficientAmount": "O saldo é insuficiente para este valor.",
        "InsufficientFee": "O saldo é insuficiente para pagar a taxa da rede.",
        "Pending": "Aguarde a conclusão do pagamento anterior.",
        "Locked": "A carteira está bloqueada. Desbloqueie e tente de novo.",
        "Failed": "Não foi possível enviar o pagamento."
      }
    },
    "Fee": {
      "Estimate": "Taxa da rede: {{amount}}",
      "UpTo": "Taxa da rede: até {{amount}}",
      "Usdc": "Pagar taxa em USDC",
      "Failed": "Não foi possível estimar a taxa da rede.",
      "Warnings": {
        "insufficient-native-balance": "O saldo é insuficiente para pagar a taxa da rede."
      }
    },
    "Status": {
      "pending": "Pendente",
      "success": "Concluído",
      "failed": "Falhou",
      "unknown": "Desconhecido"
    },
    "History": {
      "Header": "Histórico",
      "Empty": "Nenhum pagamento ainda.",
      "LoadFailed": "Não foi possível carregar o histórico. Puxe para baixo para tentar de novo.",
      "PartialNote": "Pagamentos antigos e transferências recebidas da moeda própria da rede podem não aparecer aqui.",
      "Direction": {
        "in": "De {{address}}",
        "out": "Para {{address}}",
        "self": "Para você mesmo"
      }
    },
    "Scan": {
      "Header": "Ler QR",
      "NotAnAddress": "Este código QR não contém um endereço.",
      "Unsupported": "Esta solicitação de pagamento é de outra rede ou outro token."
    },
    "Settings": {
      "Header": "Configurações de pagamento",
      "Sections": {
        "Network": "Rede",
        "Security": "Segurança",
        "Wallet": "Carteira"
      },
      "DefaultChain": "Rede padrão",
      "SaveFailed": "Não foi possível salvar a rede padrão.",
      "RevealPhrase": "Mostrar frase de recuperação",
      "RemoveWallet": "Remover carteira de pagamentos"
    },
    "Reveal": {
      "Header": "Frase de recuperação",
      "Title": "Sua frase de recuperação",
      "Warning": "Qualquer pessoa com estas palavras pode levar seus fundos. Não as compartilhe e não faça captura de tela.",
      "Confirm": "Confirme para mostrar a frase de recuperação",
      "Failed": "Não foi possível mostrar a frase de recuperação."
    },
    "Remove": {
      "Header": "Remover carteira",
      "Title": "Remover a carteira de pagamentos?",
      "Warning": "Isto remove a carteira de pagamentos deste dispositivo. Sem sua frase de recuperação, estes fundos não podem ser recuperados. Suas credenciais não são afetadas.",
      "Confirm": "Confirme para remover a carteira de pagamentos",
      "Submit": "Remover",
      "Failed": "Não foi possível remover a carteira."
    }
  },
  "Biometry": {
    "Biometrics": "Biometria",
    "Enable": "Ativar biometria",
    "Toggle": "Alternar biometria",
    "EnabledText1": "Faça login com a biometria do seu telefone em vez do PIN da carteira. Isso significa que todos os dados de impressão digital e reconhecimento facial cadastrados neste telefone podem ser usados para acessar o aplicativo Heka Wallet.",
    "EnabledText2": "Garanta que somente você tenha acesso ao seu aplicativo Heka Wallet.",
    "Warning": "Garanta que somente você tenha acesso ao seu aplicativo Heka Wallet.",
    "UseToUnlock": "Usar biometria para desbloquear o aplicativo",
    "Skip": "Pular",
    "EnabledTitle": "Permitir uso de biometria",
    "EnabledDescription": "Configure a biometria nas configurações do dispositivo",
    "OpenSettings": "Abrir configurações"
  },
  "Connection": {
    "MakingConnection": "Estabelecendo uma conexão segura.",
    "UnknownConnection": "Conexão desconhecida"
  },
  "ConnectionDetails": {
    "Rename": "Renomear",
    "Delete": "Excluir"
  },
  "Contacts": {
    "TypeHere": "Mensagem"
  },
  "Credentials": {
    "Credential": "Credencial",
    "Issuer": "Emissor",
    "AddCredential": "Adicionar credencial",
    "EmptyList": "Sua carteira está vazia.",
    "LoadFailed": "Algumas credenciais não puderam ser carregadas.",
    "AddFirstCredential": "Adicione sua primeira credencial",
    "UnknownIssuer": "Emissor desconhecido",
    "UnknownVerifier": "Verificador desconhecido"
  },
  "CredentialOffer": {
    "EnterCredentialPIN": "Por favor, insira o PIN da credencial",
    "CredentialAddedToYourWallet": "Sua credencial está pronta para uso.",
    "CredentialOnTheWay": "Sua credencial está a caminho.",
    "IssuedBy": "Emitido por"
  },
  "ProofRequest": {
    "RequestedInformation": "Informações solicitadas",
    "PresentationOnTheWay": "Sua apresentação está a caminho.",
    "PresentationAccepted": "Você está dentro! \nSua prova de apresentação foi aceita."
  },
  "Notifications": {
    "CredentialOffer": "Oferta de credencial",
    "Credential": "Credencial",
    "ProofRequest": "Solicitação de prova",
    "ProofPresentation": "Apresentação de prova",
    "CredentialRevoked": "Credencial revogada",
    "Received": "Recebido",
    "Requested": "Solicitado",
    "Sent": "Enviado",
    "Accepted": "Aceito",
    "Declined": "Recusado"
  },
  "Onboarding": {
    "Welcome": "Bem-vindo",
    "WelcomeParagraph1": "O aplicativo Heka Wallet permite que você receba, armazene e use credenciais digitais.",
    "WelcomeParagraph2": "Ele é altamente seguro e ajuda a proteger sua privacidade online.",
    "StoredSecurelyTitle": "Credenciais digitais, armazenadas com segurança",
    "StoredSecurelyBody": "O Heka Wallet armazena credenciais digitais — versões digitais de documentos como licenças, identidades, autorizações, receitas médicas, etc. Elas são armazenadas de forma segura, apenas neste dispositivo.",
    "UsingCredentialsTitle": "Recebendo e utilizando credenciais",
    "UsingCredentialsBody": "Para receber e usar credenciais, utilize o recurso “Escanear” no aplicativo para escanear um código QR especial. As informações são enviadas e recebidas por meio de uma conexão privada e criptografada.",
    "PaymentsTitle": "Pagamentos, separados",
    "PaymentsBody": "O aplicativo Heka Wallet também pode ter uma carteira de pagamentos para redes de teste. É opcional, e suas chaves nunca saem deste dispositivo. Credenciais e pagamentos não compartilham informações.",
    "PrivacyConfidentiality": "Privacidade e confidencialidade",
    "PrivacyParagraph": "Você aprova cada uso das informações do seu aplicativo Heka Wallet. Você também compartilha apenas o necessário para cada situação. A administração do aplicativo ou terceiros não são informados sobre quando e como você utiliza suas credenciais digitais.",
    "GetStarted": "Começar",
    "SkipA11y": "Pular introdução",
    "AlreadyHaveAWallet": "Já possui uma carteira de backup?",
    "UseWalletRecovery": "Usar recuperação de carteira",
    "RestoreWallet": "Restaurar carteira"
  },
  "Screens": {
    "Onboarding": "Heka Wallet"
  },
  "NetInfo": {
    "NoInternetConnectionTitle": "Sem conexão com a internet",
    "NoInternetConnectionMessage": "Você não pode acessar os serviços usando o Heka Wallet ou receber credenciais até estar online.\n\nPor favor, verifique sua conexão com a internet."
  },
  "CameraDisclosure": {
    "AllowCameraUse": "Permitir uso da câmera",
    "CameraDisclosure": "A câmera é utilizada para escanear códigos QR que iniciam uma oferta ou solicitação de credencial. Nenhuma informação sobre as imagens é armazenada, utilizada para análise ou compartilhada.",
    "ToContinueUsing": "Para continuar usando o recurso de escaneamento do Heka Wallet, por favor permita o acesso à câmera.",
    "Allow": "Permitir",
    "OpenSettings": "Abrir configurações"
  },
  "Scan": {
    "ScanOnySpecial": "Apenas códigos QR específicos podem ser escaneados pelo Heka Wallet.",
    "ScanOnlySpecial3": "O Heka Wallet atualmente não suporta a adição de credenciais digitais por meio do escaneamento ou fotografias de documentos físicos.",
    "WhereToUseLink": "Veja onde você pode usar o Heka Wallet",
    "BadQRCodeDescription": "O código QR escaneado não é compatível com o Heka Wallet. O Heka Wallet funciona apenas com serviços participantes.\n\nAtualmente, não é possível adicionar credenciais digitais por meio de fotografias de documentos físicos."
  },
  "Settings": {
    "PoweredBy": "Powered by",
    "WhatAreContacts": "O que são contatos?",
    "AppSettings": "Configurações do aplicativo",
    "Account": "Conta",
    "Troubleshoot": "Solução de problemas",
    "ShareLogs": "Compartilhar logs",
    "Information": "Informações",
    "Terms": "Termos de uso",
    "Introduction": "Introdução",
    "UserProfile": "Perfil do usuário",
    "DeleteMyAccount": "Excluir minha conta",
    "DataManagement": "Gerenciamento de dados",
    "ProximityPresentation": "Apresentação por proximidade",
    "Logs": "Logs"
  },
  "UserProfile": {
    "UserId": "ID do usuário",
    "Name": "Nome",
    "Email": "Email",
    "NoConnectionInfoText": "Sem conexão com a internet - os dados podem estar desatualizados"
  },
  "Developer": {
    "Environment": "Ambiente",
    "Production": "Produção",
    "Development": "Desenvolvimento",
    "Test": "Teste",
    "DeveloperMode": "Modo desenvolvedor",
    "Toggle": "Alternar modo desenvolvedor"
  },
  "ItemsList": {
    "Empty": "Nenhum item"
  },
  "Loading": {
    "GoBack": "Voltar"
  },
  "Global": {
    "Accept": "Aceitar",
    "Decline": "Recusar",
    "YesDecline": "Sim, recusar",
    "DontDecline": "Não recusar",
    "DontRemove": "Não remover",
    "Done": "Concluído",
    "Continue": "Continuar"
  },
  "PINCreate": {
    "CreatePinTitle": "Criar um PIN",
    "CreatePinText": "Crie um PIN para proteger sua carteira. Se você esquecê-lo, pode ser necessário configurar sua carteira novamente e readicionar suas credenciais.",
    "ReEnterPinTitle": "Digite o PIN novamente",
    "ReEnterPinText": "Digite o PIN novamente para proteger sua carteira. Se você esquecê-lo, pode ser necessário configurar sua carteira novamente e readicionar suas credenciais.",
    "EnterOldPinTitle": "Digite seu PIN antigo",
    "EnterOldPinText": "Digite seu PIN atual para continuar. Se você esquecê-lo, pode ser necessário configurar sua carteira novamente e readicionar suas credenciais.",
    "EnterNewPinTitle": "Digite um novo PIN",
    "EnterNewPinText": "Escolha um novo PIN para sua carteira. Certifique-se de que seja algo que você se lembre. Se você esquecê-lo, pode ser necessário configurar sua carteira novamente e readicionar suas credenciais.",
    "ReEnterNewPinTitle": "Confirme o novo PIN",
    "ReEnterNewPinText": "Por favor, confirme o novo PIN para proteger sua carteira. Se você esquecê-lo, pode ser necessário configurar sua carteira novamente e readicionar suas credenciais."
  },
  "PINEnter": {
    "EnterPIN": "Digite o PIN da sua carteira"
  },
  "PINConfirmation": {
    "Label": "Senha",
    "Invalid": "Senha inválida"
  },
  "Proof": {
    "SharedInformation": "Informações compartilhadas"
  },
  "Chat": {
    "YouConnected": "Você se conectou com",
    "CredentialProposalSent": "Enviou uma proposta de credencial",
    "CredentialOfferReceived": "Enviou uma oferta de credencial",
    "CredentialRequestSent": "Enviou uma solicitação de credencial",
    "CredentialDeclined": "Recusou uma oferta de credencial",
    "CredentialReceived": "Recebeu uma credencial",
    "ProofRequestSent": "Enviou uma solicitação de prova",
    "ProofPresentationReceived": "Enviou informações para você",
    "ProofRequestReceived": "Recebeu uma solicitação de prova",
    "ProofRequestRejected": "Rejeitou uma solicitação de prova",
    "ProofRequestRejectReceived": "Rejeitou uma solicitação de prova",
    "ProofRequestSatisfied": "Compartilhou informações"
  },
  "DigitalCredentials": {
    "EnterPinToShare": "Insira seu PIN para compartilhar uma credencial",
    "SharingWith": "Compartilhando com {{origin}}",
    "IncorrectPin": "PIN incorreto. Tente novamente.",
    "Cancel": "Cancelar",
    "CredentialTitleFallback": "Credencial",
    "IssuedBy": "Emitido por {{issuer}}",
    "UnknownIssuer": "Emissor desconhecido"
  }
}

export default translation
