import type { Metadata } from "next";

export const SITE_URL = "https://doodle.samistudio.nl";
export const SUPPORTED_LOCALES = ["en", "nl", "de", "fr", "es", "pt-br", "it", "ja", "ko", "ar"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export interface DoodleCopy {
  localeLabel: string;
  header: { homeLabel: string; languageLabel: string };
  composer: {
    title: string;
    hint: string;
    label: string;
    placeholder: string;
    create: string;
    drawing: string;
  };
  status: {
    generatingEyebrow: string;
    generatingTitle: string;
    waitHint: string;
    readyEyebrow: string;
    readyTitle: string;
  };
  errors: { refused: string; timeout: string; general: string; unavailable: string; rateLimited: string };
  suggestions: { title: string; items: readonly [string, string, string] };
  stage: {
    loadingPrimary: string;
    loadingMessages: readonly [string, string, string, string, string];
    loadingSr: string;
    generatedAlt: string;
    viewLarger: string;
    referenceAria: string;
    referenceAlt: string;
  };
  actions: { download: string; tryAgain: string; newScene: string };
  dialog: {
    label: string;
    close: string;
    imageAlt: string;
    native: string;
    download: string;
  };
  seo: {
    title: string;
    description: string;
    introTitle: string;
    introBody: string;
    howTitle: string;
    steps: readonly [string, string, string];
    useTitle: string;
    useBody: string;
  };
}

const COPY = {
  en: {
    localeLabel: "English",
    header: { homeLabel: "Doodle home", languageLabel: "Language" },
    composer: {
      title: "What should we doodle?",
      hint: "Keep it small and clear.",
      label: "Describe a scene",
      placeholder: "A small moment...",
      create: "Create doodle",
      drawing: "Drawing...",
    },
    status: {
      generatingEyebrow: "A small moment in progress",
      generatingTitle: "Drawing your doodle.",
      waitHint: "The simple lines take a little time. You can stay right here.",
      readyEyebrow: "A fresh doodle, made",
      readyTitle: "Your doodle is ready.",
    },
    errors: {
      refused: "That scene could not be drawn. Try describing it differently.",
      timeout: "The doodle took too long. Please try again.",
      general: "Doodle could not finish that image. Please try again.",
      unavailable: "Doodle generation is temporarily unavailable. Please try again later.",
      rateLimited: "You've made a lot of doodles today. Try again tomorrow.",
    },
    suggestions: {
      title: "Or try one",
      items: ["A person giving someone a warm scarf", "A couple dancing in the kitchen", "A dog wearing a party hat"],
    },
    stage: {
      loadingPrimary: "Drawing your doodle...",
      loadingMessages: [
        "Clearing a fresh note…",
        "Sketching the main shapes…",
        "Keeping the lines simple…",
        "Adding the last little details…",
        "Still drawing — this one needs a moment.",
      ],
      loadingSr: "This can take up to two minutes.",
      generatedAlt: "Generated sticky-note doodle",
      viewLarger: "View larger",
      referenceAria: "View example doodle larger",
      referenceAlt: "Simple sticky-note doodle of two cats kissing upside down",
    },
    actions: { download: "Download", tryAgain: "Try again", newScene: "New scene" },
    dialog: {
      label: "Doodle image viewer",
      close: "Close image",
      imageAlt: "Sticky-note doodle",
      native: "Open in new tab",
      download: "Download",
    },
    seo: {
      title: "AI Doodle Generator – Simple Drawings to Copy | Doodle",
      description: "Turn text into a simple AI doodle you can copy by hand. Describe a small scene and create a charming sticky-note drawing in moments.",
      introTitle: "Turn a small moment into an easy doodle",
      introBody: "Doodle is a text-to-drawing tool for people who want a simple picture, not a polished piece of AI art. Describe a tiny scene and get a clear sticky-note doodle made to copy by hand.",
      howTitle: "How it works",
      steps: ["Describe one small, clear scene.", "Let Doodle simplify it into friendly lines.", "Open, download or copy the finished drawing by hand."],
      useTitle: "Made for notes, cards and small surprises",
      useBody: "Create easy doodles for lunchbox notes, greeting cards, journals, classroom ideas or any moment that deserves a quick handmade picture.",
    },
  },
  nl: {
    localeLabel: "Nederlands",
    header: { homeLabel: "Doodle-startpagina", languageLabel: "Taal" },
    composer: {
      title: "Wat zullen we tekenen?",
      hint: "Hou het klein en duidelijk.",
      label: "Beschrijf een scène",
      placeholder: "Een klein moment...",
      create: "Maak een doodle",
      drawing: "Aan het tekenen...",
    },
    status: {
      generatingEyebrow: "Een klein moment in de maak",
      generatingTitle: "Je doodle wordt getekend.",
      waitHint: "Eenvoudige lijnen kosten even tijd. Blijf gerust hier.",
      readyEyebrow: "Een verse doodle",
      readyTitle: "Je doodle is klaar.",
    },
    errors: {
      refused: "Deze scène kon niet worden getekend. Beschrijf haar eens anders.",
      timeout: "De doodle duurde te lang. Probeer het opnieuw.",
      general: "Doodle kon de tekening niet afmaken. Probeer het opnieuw.",
      unavailable: "Doodles maken is tijdelijk niet beschikbaar. Probeer het later opnieuw.",
      rateLimited: "Je hebt vandaag veel doodles gemaakt. Probeer het morgen opnieuw.",
    },
    suggestions: {
      title: "Of probeer deze",
      items: ["Iemand die een warme sjaal cadeau geeft", "Een stel dat in de keuken danst", "Een hond met een feesthoedje"],
    },
    stage: {
      loadingPrimary: "Je doodle wordt getekend...",
      loadingMessages: ["Een nieuw briefje pakken…", "De belangrijkste vormen schetsen…", "De lijnen eenvoudig houden…", "De laatste details toevoegen…", "Nog even — deze tekening heeft wat tijd nodig."],
      loadingSr: "Dit kan maximaal twee minuten duren.",
      generatedAlt: "Gegenereerde doodle op een notitieblaadje",
      viewLarger: "Groter bekijken",
      referenceAria: "Voorbeelddoodle groter bekijken",
      referenceAlt: "Eenvoudige doodle van twee ondersteboven kussende katten op een geel briefje",
    },
    actions: { download: "Downloaden", tryAgain: "Opnieuw", newScene: "Nieuwe scène" },
    dialog: { label: "Doodle-afbeelding", close: "Afbeelding sluiten", imageAlt: "Doodle op een notitieblaadje", native: "Openen in nieuw tabblad", download: "Downloaden" },
    seo: {
      title: "AI-doodlegenerator – simpele tekeningen om na te tekenen | Doodle",
      description: "Zet tekst om in een simpele AI-doodle die je met de hand kunt natekenen. Beschrijf een klein moment en maak direct een leuke tekening.",
      introTitle: "Maak van een klein moment een simpele doodle",
      introBody: "Doodle is een tekst-naar-tekening-tool voor wie een eenvoudige afbeelding zoekt, geen glad AI-kunstwerk. Beschrijf een kleine scène en krijg een duidelijke doodle die je makkelijk met de hand kunt natekenen.",
      howTitle: "Zo werkt het",
      steps: ["Beschrijf één kleine, duidelijke scène.", "Doodle vertaalt die naar vriendelijke, eenvoudige lijnen.", "Bekijk, download of teken het resultaat met de hand na."],
      useTitle: "Voor briefjes, kaarten en kleine verrassingen",
      useBody: "Maak makkelijke doodles voor lunchtrommelbriefjes, wenskaarten, journals, de klas of ieder moment dat een handgemaakte tekening verdient.",
    },
  },
  de: {
    localeLabel: "Deutsch",
    header: { homeLabel: "Doodle-Startseite", languageLabel: "Sprache" },
    composer: { title: "Was sollen wir zeichnen?", hint: "Klein und eindeutig ist am besten.", label: "Beschreibe eine Szene", placeholder: "Ein kleiner Moment...", create: "Doodle erstellen", drawing: "Wird gezeichnet..." },
    status: { generatingEyebrow: "Ein kleiner Moment entsteht", generatingTitle: "Dein Doodle wird gezeichnet.", waitHint: "Die einfachen Linien brauchen einen Moment. Bleib einfach hier.", readyEyebrow: "Frisch gezeichnet", readyTitle: "Dein Doodle ist fertig." },
    errors: { refused: "Diese Szene konnte nicht gezeichnet werden. Beschreibe sie anders.", timeout: "Das Doodle hat zu lange gebraucht. Versuch es noch einmal.", general: "Doodle konnte das Bild nicht fertigstellen. Versuch es noch einmal.", unavailable: "Das Erstellen von Doodles ist vorübergehend nicht verfügbar. Versuch es später erneut.", rateLimited: "Du hast heute schon viele Doodles erstellt. Versuch es morgen wieder." },
    suggestions: { title: "Oder probiere das", items: ["Jemand schenkt einer Person einen warmen Schal", "Ein Paar tanzt in der Küche", "Ein Hund mit Partyhut"] },
    stage: { loadingPrimary: "Dein Doodle wird gezeichnet...", loadingMessages: ["Ein frischer Notizzettel liegt bereit…", "Die wichtigsten Formen entstehen…", "Die Linien bleiben schön einfach…", "Die letzten kleinen Details kommen dazu…", "Noch einen Moment — dieses Bild braucht etwas Zeit."], loadingSr: "Das kann bis zu zwei Minuten dauern.", generatedAlt: "Erstelltes Doodle auf einem Notizzettel", viewLarger: "Größer ansehen", referenceAria: "Beispiel-Doodle größer ansehen", referenceAlt: "Einfaches Doodle von zwei kopfüber küssenden Katzen auf einem gelben Notizzettel" },
    actions: { download: "Herunterladen", tryAgain: "Noch einmal", newScene: "Neue Szene" },
    dialog: { label: "Doodle-Bildansicht", close: "Bild schließen", imageAlt: "Doodle auf einem Notizzettel", native: "In neuem Tab öffnen", download: "Herunterladen" },
    seo: { title: "KI-Doodle-Generator – einfache Bilder zum Nachzeichnen | Doodle", description: "Verwandle Text in ein einfaches KI-Doodle zum Nachzeichnen. Beschreibe eine kleine Szene und erstelle in wenigen Augenblicken eine charmante Zeichnung.", introTitle: "Aus einem kleinen Moment wird ein einfaches Doodle", introBody: "Doodle ist ein Text-zu-Zeichnung-Tool für alle, die ein einfaches Bild statt aufwendiger KI-Kunst suchen. Beschreibe eine kleine Szene und erhalte ein klares Doodle, das du leicht von Hand nachzeichnen kannst.", howTitle: "So funktioniert es", steps: ["Beschreibe eine kleine, klare Szene.", "Doodle vereinfacht sie zu freundlichen Linien.", "Öffne oder lade das Bild herunter und zeichne es von Hand nach."], useTitle: "Für Notizen, Karten und kleine Überraschungen", useBody: "Erstelle einfache Doodles für Brotdosen-Zettel, Grußkarten, Journals, den Unterricht oder jeden Moment, der ein kleines handgezeichnetes Bild verdient." },
  },
  fr: {
    localeLabel: "Français",
    header: { homeLabel: "Accueil de Doodle", languageLabel: "Langue" },
    composer: { title: "Qu’allons-nous dessiner ?", hint: "Choisissez une scène simple et précise.", label: "Décrivez une scène", placeholder: "Un petit moment...", create: "Créer le dessin", drawing: "Dessin en cours..." },
    status: { generatingEyebrow: "Un petit moment prend forme", generatingTitle: "Votre dessin prend vie.", waitHint: "Les lignes simples demandent un peu de temps. Restez ici.", readyEyebrow: "Tout juste dessiné", readyTitle: "Votre dessin est prêt." },
    errors: { refused: "Cette scène n’a pas pu être dessinée. Essayez de la décrire autrement.", timeout: "Le dessin a pris trop de temps. Veuillez réessayer.", general: "Doodle n’a pas pu terminer l’image. Veuillez réessayer.", unavailable: "La création de dessins est momentanément indisponible. Réessayez plus tard.", rateLimited: "Vous avez créé beaucoup de dessins aujourd’hui. Réessayez demain." },
    suggestions: { title: "Ou essayez ceci", items: ["Une personne offre une écharpe bien chaude", "Un couple danse dans la cuisine", "Un chien avec un chapeau de fête"] },
    stage: { loadingPrimary: "Votre dessin prend vie...", loadingMessages: ["Une nouvelle note se prépare…", "Les formes principales apparaissent…", "Les lignes restent toutes simples…", "Les derniers petits détails arrivent…", "Encore un instant — ce dessin demande un peu de temps."], loadingSr: "Cela peut prendre jusqu’à deux minutes.", generatedAlt: "Doodle généré sur une note adhésive", viewLarger: "Agrandir", referenceAria: "Agrandir l’exemple de doodle", referenceAlt: "Doodle simple de deux chats qui s’embrassent la tête en bas sur une note jaune" },
    actions: { download: "Télécharger", tryAgain: "Réessayer", newScene: "Nouvelle scène" },
    dialog: { label: "Visionneuse du doodle", close: "Fermer l’image", imageAlt: "Doodle sur une note adhésive", native: "Ouvrir dans un nouvel onglet", download: "Télécharger" },
    seo: { title: "Générateur de dessins IA – doodles simples à recopier | Doodle", description: "Transformez un texte en dessin IA simple à recopier à la main. Décrivez une petite scène et créez un doodle charmant en quelques instants.", introTitle: "Transformez un petit moment en doodle facile", introBody: "Doodle est un outil texte-vers-dessin pour celles et ceux qui veulent une image simple, et non une œuvre IA trop travaillée. Décrivez une petite scène et obtenez un dessin clair, facile à reproduire à la main.", howTitle: "Comment ça marche", steps: ["Décrivez une seule petite scène, clairement.", "Doodle la simplifie en quelques lignes chaleureuses.", "Ouvrez, téléchargez ou recopiez le dessin à la main."], useTitle: "Pour les petits mots, les cartes et les surprises", useBody: "Créez des doodles faciles pour un mot dans la boîte à goûter, une carte, un journal, la classe ou tout moment qui mérite un petit dessin fait main." },
  },
  es: {
    localeLabel: "Español",
    header: { homeLabel: "Inicio de Doodle", languageLabel: "Idioma" },
    composer: { title: "¿Qué dibujamos?", hint: "Elige una escena pequeña y clara.", label: "Describe una escena", placeholder: "Un pequeño momento...", create: "Crear dibujo", drawing: "Dibujando..." },
    status: { generatingEyebrow: "Un pequeño momento en proceso", generatingTitle: "Estamos dibujando tu idea.", waitHint: "Las líneas sencillas llevan un poco de tiempo. Puedes quedarte aquí.", readyEyebrow: "Recién dibujado", readyTitle: "Tu dibujo está listo." },
    errors: { refused: "No pudimos dibujar esa escena. Prueba a describirla de otra manera.", timeout: "El dibujo tardó demasiado. Inténtalo de nuevo.", general: "Doodle no pudo terminar la imagen. Inténtalo de nuevo.", unavailable: "La creación de dibujos no está disponible temporalmente. Vuelve a intentarlo más tarde.", rateLimited: "Has creado muchos dibujos hoy. Vuelve a intentarlo mañana." },
    suggestions: { title: "O prueba una idea", items: ["Una persona regalándole una bufanda a alguien", "Una pareja bailando en la cocina", "Un perro con gorro de fiesta"] },
    stage: { loadingPrimary: "Estamos dibujando tu idea...", loadingMessages: ["Preparando una nota nueva…", "Trazando las formas principales…", "Manteniendo las líneas sencillas…", "Añadiendo los últimos detalles…", "Seguimos dibujando — esta escena necesita un momento."], loadingSr: "Puede tardar hasta dos minutos.", generatedAlt: "Doodle generado sobre una nota adhesiva", viewLarger: "Ver más grande", referenceAria: "Ver el doodle de ejemplo más grande", referenceAlt: "Doodle sencillo de dos gatos besándose boca abajo sobre una nota amarilla" },
    actions: { download: "Descargar", tryAgain: "Intentar de nuevo", newScene: "Nueva escena" },
    dialog: { label: "Visor del dibujo", close: "Cerrar imagen", imageAlt: "Doodle sobre una nota adhesiva", native: "Abrir en una pestaña nueva", download: "Descargar" },
    seo: { title: "Generador de dibujos con IA – doodles fáciles de copiar | Doodle", description: "Convierte texto en un dibujo sencillo con IA que puedas copiar a mano. Describe una pequeña escena y crea un doodle encantador en unos instantes.", introTitle: "Convierte un pequeño momento en un dibujo fácil", introBody: "Doodle es una herramienta de texto a dibujo para quien busca una imagen sencilla, no una obra de IA recargada. Describe una pequeña escena y recibe un doodle claro que puedas copiar fácilmente a mano.", howTitle: "Cómo funciona", steps: ["Describe una escena pequeña y concreta.", "Doodle la simplifica con líneas claras y amables.", "Abre, descarga o copia el dibujo a mano."], useTitle: "Para notas, tarjetas y pequeñas sorpresas", useBody: "Crea doodles fáciles para notas de almuerzo, tarjetas, diarios, ideas para clase o cualquier momento que merezca un dibujo hecho a mano." },
  },
  "pt-br": {
    localeLabel: "Português (Brasil)",
    header: { homeLabel: "Início do Doodle", languageLabel: "Idioma" },
    composer: { title: "O que vamos desenhar?", hint: "Escolha uma cena pequena e clara.", label: "Descreva uma cena", placeholder: "Um pequeno momento...", create: "Criar desenho", drawing: "Desenhando..." },
    status: { generatingEyebrow: "Um pequeno momento ganhando forma", generatingTitle: "Estamos fazendo seu desenho.", waitHint: "Linhas simples levam um tempinho. Pode ficar por aqui.", readyEyebrow: "Desenho novinho", readyTitle: "Seu desenho está pronto." },
    errors: { refused: "Não foi possível desenhar essa cena. Tente descrevê-la de outro jeito.", timeout: "O desenho demorou demais. Tente novamente.", general: "O Doodle não conseguiu terminar a imagem. Tente novamente.", unavailable: "A criação de desenhos está temporariamente indisponível. Tente mais tarde.", rateLimited: "Você já criou muitos desenhos hoje. Tente de novo amanhã." },
    suggestions: { title: "Ou experimente uma ideia", items: ["Uma pessoa dando um cachecol quentinho para alguém", "Um casal dançando na cozinha", "Um cachorro usando chapéu de festa"] },
    stage: { loadingPrimary: "Estamos fazendo seu desenho...", loadingMessages: ["Preparando um novo bloquinho…", "Rascunhando as formas principais…", "Mantendo os traços simples…", "Acrescentando os últimos detalhes…", "Ainda desenhando — esta cena precisa de mais um momento."], loadingSr: "Isso pode levar até dois minutos.", generatedAlt: "Desenho gerado em um bloquinho adesivo", viewLarger: "Ver maior", referenceAria: "Ver o desenho de exemplo em tamanho maior", referenceAlt: "Desenho simples de dois gatos se beijando de cabeça para baixo em um bloquinho amarelo" },
    actions: { download: "Baixar", tryAgain: "Tentar novamente", newScene: "Nova cena" },
    dialog: { label: "Visualizador do desenho", close: "Fechar imagem", imageAlt: "Desenho em um bloquinho adesivo", native: "Abrir em nova aba", download: "Baixar" },
    seo: { title: "Gerador de desenho com IA – desenhos fáceis de copiar | Doodle", description: "Transforme texto em um desenho simples com IA para copiar à mão. Descreva uma pequena cena e crie um doodle encantador em instantes.", introTitle: "Transforme um pequeno momento em um desenho fácil", introBody: "Doodle é uma ferramenta de texto para desenho feita para quem quer uma imagem simples, não uma arte de IA cheia de detalhes. Descreva uma pequena cena e receba um desenho claro e fácil de copiar à mão.", howTitle: "Como funciona", steps: ["Descreva uma cena pequena e objetiva.", "O Doodle simplifica a ideia em traços leves e claros.", "Abra, baixe ou copie o resultado à mão."], useTitle: "Para bilhetes, cartões e pequenas surpresas", useBody: "Crie desenhos fáceis para bilhetes na lancheira, cartões, diários, atividades escolares ou qualquer momento que mereça um toque feito à mão." },
  },
  it: {
    localeLabel: "Italiano",
    header: { homeLabel: "Home di Doodle", languageLabel: "Lingua" },
    composer: { title: "Cosa disegniamo?", hint: "Scegli una scena piccola e chiara.", label: "Descrivi una scena", placeholder: "Un piccolo momento...", create: "Crea disegno", drawing: "Sto disegnando..." },
    status: { generatingEyebrow: "Un piccolo momento prende forma", generatingTitle: "Sto creando il tuo disegno.", waitHint: "Le linee semplici richiedono un po’ di tempo. Puoi restare qui.", readyEyebrow: "Appena disegnato", readyTitle: "Il tuo disegno è pronto." },
    errors: { refused: "Non è stato possibile disegnare questa scena. Prova a descriverla in un altro modo.", timeout: "Il disegno ha impiegato troppo tempo. Riprova.", general: "Doodle non è riuscito a completare l’immagine. Riprova.", unavailable: "La creazione dei disegni non è momentaneamente disponibile. Riprova più tardi.", rateLimited: "Hai già creato molti doodle oggi. Riprova domani." },
    suggestions: { title: "Oppure prova un’idea", items: ["Una persona regala a qualcuno una sciarpa calda", "Una coppia balla in cucina", "Un cane con un cappellino da festa"] },
    stage: { loadingPrimary: "Sto creando il tuo disegno...", loadingMessages: ["Preparo un nuovo foglietto…", "Disegno le forme principali…", "Mantengo le linee semplici…", "Aggiungo gli ultimi dettagli…", "Sto ancora disegnando — serve ancora un momento."], loadingSr: "Potrebbero volerci fino a due minuti.", generatedAlt: "Doodle generato su un foglietto adesivo", viewLarger: "Ingrandisci", referenceAria: "Ingrandisci il doodle di esempio", referenceAlt: "Doodle semplice di due gatti che si baciano a testa in giù su un foglietto giallo" },
    actions: { download: "Scarica", tryAgain: "Riprova", newScene: "Nuova scena" },
    dialog: { label: "Visualizzatore del doodle", close: "Chiudi immagine", imageAlt: "Doodle su un foglietto adesivo", native: "Apri in una nuova scheda", download: "Scarica" },
    seo: { title: "Generatore di disegni IA – doodle facili da copiare | Doodle", description: "Trasforma il testo in un semplice disegno IA da copiare a mano. Descrivi una piccola scena e crea un doodle in pochi istanti.", introTitle: "Trasforma un piccolo momento in un doodle facile", introBody: "Doodle è uno strumento da testo a disegno per chi cerca un’immagine semplice, non un’elaborata opera d’arte IA. Descrivi una piccola scena e ottieni un doodle chiaro e facile da riprodurre a mano.", howTitle: "Come funziona", steps: ["Descrivi una scena piccola e precisa.", "Doodle la semplifica in linee chiare e amichevoli.", "Apri, scarica o copia il disegno a mano."], useTitle: "Per biglietti, cartoline e piccole sorprese", useBody: "Crea doodle facili per messaggi nella merenda, biglietti d’auguri, diari, attività in classe o qualsiasi momento che meriti un piccolo disegno fatto a mano." },
  },
  ja: {
    localeLabel: "日本語",
    header: { homeLabel: "Doodle ホーム", languageLabel: "言語" },
    composer: { title: "何を描こう？", hint: "小さくて分かりやすい場面がおすすめです。", label: "場面を入力", placeholder: "小さなひととき...", create: "イラストを作る", drawing: "描いています..." },
    status: { generatingEyebrow: "小さなひとときを制作中", generatingTitle: "イラストを描いています。", waitHint: "シンプルな線にするまで少し時間がかかります。このままお待ちください。", readyEyebrow: "できたてのイラスト", readyTitle: "イラストができました。" },
    errors: { refused: "この場面は描けませんでした。別の言い方で説明してみてください。", timeout: "時間がかかりすぎました。もう一度お試しください。", general: "イラストを完成できませんでした。もう一度お試しください。", unavailable: "現在イラストを作成できません。時間をおいてお試しください。", rateLimited: "今日はたくさん作りました。また明日お試しください。" },
    suggestions: { title: "こんな場面もおすすめ", items: ["誰かに暖かいマフラーを贈る人", "キッチンで踊る二人", "パーティーハットをかぶった犬"] },
    stage: { loadingPrimary: "イラストを描いています...", loadingMessages: ["新しい付箋を用意しています…", "大まかな形を描いています…", "線をシンプルに整えています…", "最後の小さなディテールを加えています…", "もう少しだけお待ちください。"], loadingSr: "完成まで最大2分ほどかかることがあります。", generatedAlt: "付箋に描かれた生成イラスト", viewLarger: "大きく見る", referenceAria: "サンプルのイラストを大きく見る", referenceAlt: "黄色い付箋に描かれた、逆さまでキスをする2匹の猫のシンプルなイラスト" },
    actions: { download: "ダウンロード", tryAgain: "もう一度", newScene: "新しい場面" },
    dialog: { label: "イラスト画像ビューア", close: "画像を閉じる", imageAlt: "付箋に描かれたイラスト", native: "新しいタブで開く", download: "ダウンロード" },
    seo: { title: "AI落書きジェネレーター – まねして描ける簡単イラスト | Doodle", description: "文章から、手でまねして描けるシンプルなAIイラストを作成。小さな場面を説明するだけで、かわいい付箋風の絵ができます。", introTitle: "小さなひとときを、描きやすいイラストに", introBody: "Doodleは、細かすぎるAIアートではなく、シンプルな絵が欲しい人のための文章からイラストを作るツールです。小さな場面を入力すると、手でまねしやすい分かりやすい線画になります。", howTitle: "使い方", steps: ["小さくて分かりやすい場面を入力します。", "Doodleが親しみやすいシンプルな線にまとめます。", "画像を開く、保存する、または見ながら手で描きます。"], useTitle: "メモやカード、小さなサプライズに", useBody: "お弁当のメモ、グリーティングカード、日記、授業のアイデアなど、手描きのひと工夫を添えたい場面に使える簡単なイラストを作れます。" },
  },
  ko: {
    localeLabel: "한국어",
    header: { homeLabel: "Doodle 홈", languageLabel: "언어" },
    composer: { title: "무엇을 그려 볼까요?", hint: "작고 분명한 장면을 적어 주세요.", label: "장면 설명", placeholder: "작은 순간 하나...", create: "그림 만들기", drawing: "그리는 중..." },
    status: { generatingEyebrow: "작은 순간을 그리고 있어요", generatingTitle: "그림을 만들고 있어요.", waitHint: "단순한 선으로 다듬는 데 시간이 조금 걸려요. 여기서 기다려 주세요.", readyEyebrow: "방금 완성된 그림", readyTitle: "그림이 완성됐어요." },
    errors: { refused: "이 장면은 그릴 수 없었어요. 다른 말로 설명해 보세요.", timeout: "그림을 만드는 데 너무 오래 걸렸어요. 다시 시도해 주세요.", general: "그림을 완성하지 못했어요. 다시 시도해 주세요.", unavailable: "지금은 그림을 만들 수 없어요. 잠시 후 다시 시도해 주세요.", rateLimited: "오늘은 그림을 많이 만들었어요. 내일 다시 시도해 주세요." },
    suggestions: { title: "이런 장면도 좋아요", items: ["누군가에게 따뜻한 목도리를 선물하는 사람", "주방에서 춤추는 연인", "파티 모자를 쓴 강아지"] },
    stage: { loadingPrimary: "그림을 만들고 있어요...", loadingMessages: ["새 메모지를 준비하고 있어요…", "큰 모양부터 그리고 있어요…", "선을 단순하게 다듬고 있어요…", "마지막 작은 디테일을 더하고 있어요…", "조금만 더 기다려 주세요."], loadingSr: "완성까지 최대 2분 정도 걸릴 수 있어요.", generatedAlt: "메모지에 생성된 낙서 그림", viewLarger: "크게 보기", referenceAria: "예시 그림 크게 보기", referenceAlt: "노란 메모지에 거꾸로 키스하는 고양이 두 마리를 그린 단순한 그림" },
    actions: { download: "다운로드", tryAgain: "다시 만들기", newScene: "새 장면" },
    dialog: { label: "그림 이미지 뷰어", close: "이미지 닫기", imageAlt: "메모지 낙서 그림", native: "새 탭에서 열기", download: "다운로드" },
    seo: { title: "AI 낙서 생성기 – 따라 그리기 쉬운 간단한 그림 | Doodle", description: "글을 손으로 따라 그리기 쉬운 간단한 AI 그림으로 바꿔 보세요. 작은 장면을 설명하면 귀여운 메모지 그림을 만들 수 있어요.", introTitle: "작은 순간을 따라 그리기 쉬운 그림으로", introBody: "Doodle은 화려한 AI 작품보다 단순한 그림이 필요한 사람을 위한 텍스트 그림 도구예요. 작은 장면을 적으면 손으로 쉽게 따라 그릴 수 있는 분명한 낙서 그림을 만들어 줍니다.", howTitle: "이용 방법", steps: ["작고 분명한 장면 하나를 설명합니다.", "Doodle이 친근하고 단순한 선으로 정리합니다.", "그림을 열거나 내려받아 손으로 따라 그립니다."], useTitle: "메모, 카드, 작은 깜짝 선물에", useBody: "도시락 쪽지, 카드, 다이어리, 수업 아이디어처럼 손그림 한 장을 더하고 싶은 순간에 어울리는 간단한 그림을 만들 수 있어요." },
  },
  ar: {
    localeLabel: "العربية",
    header: { homeLabel: "الصفحة الرئيسية لـ Doodle", languageLabel: "اللغة" },
    composer: { title: "ماذا نرسم؟", hint: "اكتب فكرة بسيطة وواضحة.", label: "صِف ما تريد رسمه", placeholder: "اكتب فكرتك هنا...", create: "أنشئ رسمة", drawing: "جارٍ الرسم..." },
    status: { generatingEyebrow: "لحظة صغيرة قيد الرسم", generatingTitle: "نرسم فكرتك الآن.", waitHint: "تحتاج الخطوط البسيطة إلى قليل من الوقت. يمكنك الانتظار هنا.", readyEyebrow: "رسمة جديدة", readyTitle: "رسمتك جاهزة." },
    errors: { refused: "تعذّر رسم هذا المشهد. جرّب وصفه بطريقة مختلفة.", timeout: "استغرق الرسم وقتًا أطول من اللازم. حاول مرة أخرى.", general: "تعذّر على Doodle إكمال الرسمة. حاول مرة أخرى.", unavailable: "إنشاء الرسومات غير متاح مؤقتًا. حاول لاحقًا.", rateLimited: "أنشأت رسومات كثيرة اليوم. جرّب مرة أخرى غدًا." },
    suggestions: { title: "أو جرّب فكرة", items: ["شخص يهدي آخر وشاحًا دافئًا", "شخصان يرقصان في المطبخ", "كلب يرتدي قبعة احتفالية"] },
    stage: { loadingPrimary: "نرسم فكرتك...", loadingMessages: ["نحضّر ورقة ملاحظات جديدة…", "نرسم الأشكال الأساسية…", "نبقي الخطوط بسيطة…", "نضيف اللمسات الصغيرة الأخيرة…", "ما زلنا نرسم — يحتاج هذا المشهد إلى لحظة أخرى."], loadingSr: "قد يستغرق ذلك ما يصل إلى دقيقتين.", generatedAlt: "رسمة مولّدة على ورقة ملاحظات لاصقة", viewLarger: "عرض بحجم أكبر", referenceAria: "عرض الرسمة النموذجية بحجم أكبر", referenceAlt: "رسمة بسيطة لشخصية معلّقة رأسًا على عقب تقبّل قطة على ورقة ملاحظات صفراء" },
    actions: { download: "تنزيل", tryAgain: "جرّب مرة أخرى", newScene: "مشهد جديد" },
    dialog: { label: "عارض الرسمة", close: "إغلاق الصورة", imageAlt: "رسمة على ورقة ملاحظات لاصقة", native: "فتح في علامة تبويب جديدة", download: "تنزيل" },
    seo: { title: "مولّد رسومات بسيطة بالذكاء الاصطناعي | Doodle", description: "اكتب ما تريد رسمه، وسيحوّل Doodle وصفك إلى رسمة بسيطة بالذكاء الاصطناعي يمكنك تقليدها باليد. أداة سهلة وسريعة لأفكار الرسم البسيطة.", introTitle: "حوّل فكرتك إلى رسمة بسيطة", introBody: "اكتب وصفًا قصيرًا، وسيحوّله Doodle إلى رسمة واضحة يمكنك تقليدها باليد. لا صور معقّدة ولا تفاصيل زائدة—مجرد خطوط بسيطة ولطيفة.", howTitle: "طريقة الاستخدام", steps: ["اكتب وصفًا قصيرًا لمشهد واحد.", "يحوّل Doodle وصفك إلى خطوط بسيطة وواضحة.", "افتح الرسمة أو نزّلها، ثم جرّب رسمها بنفسك."], useTitle: "للبطاقات والدفاتر وكل مناسبة", useBody: "أنشئ رسومات بسيطة للبطاقات والدفاتر والأنشطة المدرسية، أو شاركها مع من تحب كلفتة لطيفة." },
  },
} satisfies Record<Locale, DoodleCopy>;

const HREFLANG_CODES: Record<Locale, string> = {
  en: "en",
  nl: "nl",
  de: "de",
  fr: "fr",
  es: "es",
  "pt-br": "pt-BR",
  it: "it",
  ja: "ja",
  ko: "ko",
  ar: "ar",
};

const OPEN_GRAPH_LOCALES: Record<Locale, string> = {
  en: "en_US",
  nl: "nl_NL",
  de: "de_DE",
  fr: "fr_FR",
  es: "es_ES",
  "pt-br": "pt_BR",
  it: "it_IT",
  ja: "ja_JP",
  ko: "ko_KR",
  ar: "ar_SA",
};

export function hasLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function getCopy(locale: Locale): DoodleCopy {
  return COPY[locale];
}

export function localePath(locale: Locale): string {
  return locale === "en" ? "/" : `/${locale}`;
}

export function htmlLang(locale: Locale): string {
  return HREFLANG_CODES[locale];
}

export function textDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function getLanguageAlternates(): Record<string, string> {
  const languages = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [HREFLANG_CODES[locale], `${SITE_URL}${localePath(locale)}`]),
  );
  return { ...languages, "x-default": `${SITE_URL}/` };
}

export function buildPageMetadata(locale: Locale): Metadata {
  const copy = getCopy(locale);
  const canonical = `${SITE_URL}${localePath(locale)}`;

  return {
    title: copy.seo.title,
    description: copy.seo.description,
    applicationName: "Doodle",
    category: "design",
    alternates: { canonical, languages: getLanguageAlternates() },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "Doodle",
      title: copy.seo.title,
      description: copy.seo.description,
      locale: OPEN_GRAPH_LOCALES[locale],
      alternateLocale: SUPPORTED_LOCALES.filter((item) => item !== locale).map((item) => OPEN_GRAPH_LOCALES[item]),
      images: [{ url: `${SITE_URL}/references/doodle-reference-kiss.png`, width: 1024, height: 1024, alt: copy.stage.referenceAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.seo.title,
      description: copy.seo.description,
      images: [`${SITE_URL}/references/doodle-reference-kiss.png`],
    },
  };
}
