import type { Metadata } from "next";
import { SITE_URL, SUPPORTED_LOCALES, type Locale, htmlLang, localePath, openGraphLocale } from "./i18n";

export const IDEA_IMAGES = [
  "/ideas/thank-you-mug.webp",
  "/ideas/cat-note.webp",
  "/ideas/birthday-dog.webp",
  "/ideas/warm-hug.webp",
  "/ideas/super-banana.webp",
  "/ideas/lunch-high-five.webp",
  "/ideas/pencil-helps-eraser.webp",
  "/ideas/school-snail.webp",
] as const;

export type IdeasCopy = {
  seoTitle: string;
  seoDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  start: string;
  viewLarger: string;
  tryIdea: string;
  moreEyebrow: string;
  moreTitle: string;
  moreBody: string;
  guideTitle: string;
  guideBody: string;
  guideCta: string;
  openTab: string;
  close: string;
  generator: string;
  browse: string;
  featured: readonly string[];
  quickIdeas: readonly string[];
};

const IDEAS_COPY: Record<Locale, IdeasCopy> = {
  en: {
    seoTitle: "Cute Doodle Ideas for Notes, Cards & Lunchboxes | Doodle",
    seoDescription: "Browse easy, cute doodle ideas for lunchbox notes, greeting cards, journals and classrooms. Open an example or send its prompt to the AI doodle generator.",
    eyebrow: "Doodle ideas",
    title: "Small drawings for real little moments.",
    description: "Copy one by hand, open it for a closer look, or use the idea as a starting point for your own doodle.",
    start: "Make a doodle",
    viewLarger: "View larger",
    tryIdea: "Try this idea",
    moreEyebrow: "More prompts",
    moreTitle: "20 more easy doodle ideas",
    moreBody: "Good prompts describe one clear moment. Keep the cast small, add one action, and leave the rest to the drawing.",
    guideTitle: "What makes a doodle idea easy to draw?",
    guideBody: "Choose a familiar subject, give it one readable action, and skip the background unless it matters. “A snail delivering a birthday card” works because the feeling survives in a few simple lines.",
    guideCta: "Turn your idea into a doodle",
    openTab: "Open image in new tab",
    close: "Close",
    generator: "Generator", browse: "Browse doodle ideas",
    featured: ["A steaming mug beside a folded thank-you note with a tiny heart on it", "A curious cat peeking over a folded paper note", "A cheerful dog holding one birthday balloon", "Two little friends hugging beneath a small heart", "A brave banana wearing a superhero cape", "A happy apple and sandwich giving each other a high-five", "A pencil helping an eraser climb onto a schoolbook", "A smiling snail carrying a school backpack and pencil"],
    quickIdeas: ["A tiny frog sheltering under a leaf", "Two socks reunited after laundry day", "A sleepy moon tucked under a cloud", "A flower handing a bee a tiny gift", "A toast slice waving good morning", "A penguin carrying a warm cup", "A bear mailing a little heart", "A happy plant growing from a teacup", "Two strawberries sharing an umbrella", "A puppy asleep beside one slipper", "A star giving the moon a high-five", "A turtle wearing a party hat", "A pencil finishing a tiny finish line", "A book hugging a bookmark", "A cloud watering one small flower", "A fox wrapped in a warm scarf", "A cupcake presenting one candle", "A whale balancing a paper boat", "A snail delivering a birthday card", "Two cherries dancing together"],
  },
  nl: {
    seoTitle: "Leuke doodle-ideeën voor briefjes, kaarten en school | Doodle",
    seoDescription: "Bekijk makkelijke doodle-ideeën voor briefjes, wenskaarten, lunchtrommels, journals en de klas. Kies een voorbeeld of maak er zelf een.",
    eyebrow: "Doodle-ideeën", title: "Kleine tekeningen voor mooie momenten.", description: "Teken een voorbeeld na, bekijk het groter of gebruik de tekst als begin voor je eigen doodle.", start: "Maak een doodle", viewLarger: "Groter bekijken", tryIdea: "Probeer dit idee", moreEyebrow: "Meer ideeën", moreTitle: "Nog 20 makkelijke doodle-ideeën", moreBody: "Een goed idee beschrijft één duidelijk moment. Kies weinig figuren, één handeling en laat de tekening de rest doen.", guideTitle: "Wat maakt een doodle makkelijk om na te tekenen?", guideBody: "Kies iets herkenbaars, geef het één duidelijke handeling en laat de achtergrond weg als die niets toevoegt. Zo blijft het gevoel ook met een paar simpele lijnen overeind.", guideCta: "Maak van je idee een doodle", openTab: "Afbeelding openen in nieuw tabblad", close: "Sluiten", generator: "Generator", browse: "Bekijk doodle-ideeën",
    featured: ["Een dampende mok naast een gevouwen bedankbriefje met een klein hartje", "Een nieuwsgierige kat die over een gevouwen briefje gluurt", "Een vrolijke hond met één verjaardagsballon", "Twee kleine vriendjes die knuffelen onder een hartje", "Een dappere banaan met een superheldencape", "Een blije appel en boterham die elkaar een high five geven", "Een potlood dat een gum op een schoolboek helpt klimmen", "Een lachende slak met een schoolrugzak en potlood"],
    quickIdeas: ["Een kleine kikker die schuilt onder een blad", "Twee sokken die elkaar terugvinden na de was", "Een slaperige maan onder een wolk", "Een bloem die een bij een cadeautje geeft", "Een boterham die goedemorgen zwaait", "Een pinguïn met een warme mok", "Een beer die een hartje op de post doet", "Een vrolijk plantje in een theekopje", "Twee aardbeien onder één paraplu", "Een puppy die naast één pantoffel slaapt", "Een ster die de maan een high five geeft", "Een schildpad met een feesthoedje", "Een potlood dat over een kleine finish komt", "Een boek dat een boekenlegger knuffelt", "Een wolk die één bloem water geeft", "Een vos met een warme sjaal", "Een cupcake met één kaarsje", "Een walvis met een papieren bootje op zijn neus", "Een slak die een verjaardagskaart bezorgt", "Twee kersen die samen dansen"],
  },
  de: {
    seoTitle: "Süße Doodle-Ideen für Notizen, Karten und Schule | Doodle",
    seoDescription: "Entdecke einfache Doodle-Ideen für Notizzettel, Grußkarten, Brotdosen, Journals und Unterricht. Wähle ein Beispiel oder erstelle dein eigenes.",
    eyebrow: "Doodle-Ideen", title: "Kleine Zeichnungen für besondere Momente.", description: "Zeichne ein Beispiel nach, öffne es größer oder nutze den Text als Ausgangspunkt für dein eigenes Doodle.", start: "Doodle erstellen", viewLarger: "Größer ansehen", tryIdea: "Idee ausprobieren", moreEyebrow: "Mehr Ideen", moreTitle: "20 weitere einfache Doodle-Ideen", moreBody: "Gute Ideen zeigen einen klaren Moment. Wenige Figuren, eine Handlung – den Rest übernimmt die Zeichnung.", guideTitle: "Was macht eine Doodle-Idee leicht zeichnbar?", guideBody: "Wähle etwas Vertrautes, gib ihm eine klare Handlung und lass den Hintergrund weg, wenn er nicht wichtig ist. So bleibt das Gefühl auch mit wenigen Linien erhalten.", guideCta: "Mach aus deiner Idee ein Doodle", openTab: "Bild in neuem Tab öffnen", close: "Schließen", generator: "Generator", browse: "Doodle-Ideen ansehen",
    featured: ["Eine dampfende Tasse neben einem gefalteten Dankeszettel mit kleinem Herz", "Eine neugierige Katze schaut über einen gefalteten Zettel", "Ein fröhlicher Hund hält einen Geburtstagsballon", "Zwei kleine Freunde umarmen sich unter einem Herz", "Eine mutige Banane mit Superheldenumhang", "Ein fröhlicher Apfel und ein Sandwich geben sich ein High Five", "Ein Bleistift hilft einem Radiergummi auf ein Schulbuch", "Eine lächelnde Schnecke mit Schulrucksack und Bleistift"],
    quickIdeas: ["Ein kleiner Frosch unter einem Blatt", "Zwei Socken finden sich nach der Wäsche wieder", "Ein schläfriger Mond unter einer Wolke", "Eine Blume schenkt einer Biene etwas Kleines", "Eine Toastscheibe winkt guten Morgen", "Ein Pinguin trägt eine warme Tasse", "Ein Bär verschickt ein kleines Herz", "Eine fröhliche Pflanze wächst aus einer Teetasse", "Zwei Erdbeeren teilen sich einen Regenschirm", "Ein Welpe schläft neben einem Hausschuh", "Ein Stern gibt dem Mond ein High Five", "Eine Schildkröte mit Partyhut", "Ein Bleistift überquert eine kleine Ziellinie", "Ein Buch umarmt ein Lesezeichen", "Eine Wolke gießt eine kleine Blume", "Ein Fuchs mit warmem Schal", "Ein Cupcake präsentiert eine Kerze", "Ein Wal balanciert ein Papierboot", "Eine Schnecke bringt eine Geburtstagskarte", "Zwei Kirschen tanzen zusammen"],
  },
  fr: {
    seoTitle: "Idées de doodles faciles pour mots, cartes et école | Doodle",
    seoDescription: "Découvrez des idées de doodles simples pour petits mots, cartes, boîtes à goûter, carnets et classe. Choisissez un exemple ou créez le vôtre.",
    eyebrow: "Idées de doodles", title: "De petits dessins pour de jolis moments.", description: "Recopiez un exemple, agrandissez-le ou utilisez sa description pour créer votre propre doodle.", start: "Créer un doodle", viewLarger: "Agrandir", tryIdea: "Essayer cette idée", moreEyebrow: "Plus d’idées", moreTitle: "20 autres idées de doodles faciles", moreBody: "Une bonne idée montre un seul moment clair. Peu de personnages, une action, et le dessin fait le reste.", guideTitle: "Qu’est-ce qui rend un doodle facile à dessiner ?", guideBody: "Choisissez un sujet familier, donnez-lui une action claire et évitez le décor s’il n’apporte rien. L’émotion reste lisible avec quelques lignes simples.", guideCta: "Transformer votre idée en doodle", openTab: "Ouvrir l’image dans un nouvel onglet", close: "Fermer", generator: "Générateur", browse: "Voir les idées de doodles",
    featured: ["Une tasse fumante près d’un petit mot de remerciement plié avec un cœur", "Un chat curieux qui regarde par-dessus un petit mot plié", "Un chien joyeux tenant un ballon d’anniversaire", "Deux petits amis qui se prennent dans les bras sous un cœur", "Une banane courageuse avec une cape de super-héros", "Une pomme et un sandwich joyeux qui se tapent dans la main", "Un crayon aide une gomme à monter sur un livre d’école", "Un escargot souriant avec un sac d’école et un crayon"],
    quickIdeas: ["Une petite grenouille abritée sous une feuille", "Deux chaussettes réunies après la lessive", "Une lune endormie sous un nuage", "Une fleur offre un petit cadeau à une abeille", "Une tartine fait signe pour dire bonjour", "Un pingouin porte une tasse chaude", "Un ours poste un petit cœur", "Une plante joyeuse pousse dans une tasse", "Deux fraises partagent un parapluie", "Un chiot dort près d’une pantoufle", "Une étoile tape dans la main de la lune", "Une tortue avec un chapeau de fête", "Un crayon franchit une petite ligne d’arrivée", "Un livre serre un marque-page dans ses bras", "Un nuage arrose une petite fleur", "Un renard emmitouflé dans une écharpe", "Un cupcake présente une bougie", "Une baleine équilibre un bateau en papier", "Un escargot livre une carte d’anniversaire", "Deux cerises dansent ensemble"],
  },
  es: {
    seoTitle: "Ideas de dibujos fáciles para notas, tarjetas y clase | Doodle",
    seoDescription: "Descubre ideas de dibujos sencillos para notas, tarjetas, fiambreras, diarios y clase. Elige un ejemplo o crea el tuyo.",
    eyebrow: "Ideas para dibujar", title: "Pequeños dibujos para momentos especiales.", description: "Copia un ejemplo, ábrelo en grande o usa su descripción para crear tu propio dibujo.", start: "Crear un dibujo", viewLarger: "Ver en grande", tryIdea: "Probar esta idea", moreEyebrow: "Más ideas", moreTitle: "20 ideas más de dibujos fáciles", moreBody: "Una buena idea muestra un momento claro. Pocos personajes, una acción y que el dibujo haga el resto.", guideTitle: "¿Qué hace que una idea sea fácil de dibujar?", guideBody: "Elige algo conocido, dale una acción clara y evita el fondo si no es importante. Así la emoción funciona incluso con unas pocas líneas.", guideCta: "Convierte tu idea en un dibujo", openTab: "Abrir imagen en una pestaña nueva", close: "Cerrar", generator: "Generador", browse: "Ver ideas para dibujar",
    featured: ["Una taza humeante junto a una nota de agradecimiento doblada con un corazón", "Un gato curioso asomándose por encima de una nota doblada", "Un perro alegre sujetando un globo de cumpleaños", "Dos pequeños amigos abrazándose bajo un corazón", "Un plátano valiente con capa de superhéroe", "Una manzana y un sándwich felices chocando las manos", "Un lápiz ayuda a una goma a subir a un libro escolar", "Un caracol sonriente con mochila escolar y lápiz"],
    quickIdeas: ["Una ranita refugiada bajo una hoja", "Dos calcetines reunidos después de la colada", "Una luna dormida bajo una nube", "Una flor regalándole algo pequeño a una abeja", "Una tostada saludando con la mano", "Un pingüino llevando una taza caliente", "Un oso enviando un pequeño corazón", "Una planta feliz creciendo en una taza", "Dos fresas compartiendo paraguas", "Un cachorro dormido junto a una zapatilla", "Una estrella chocando la mano con la luna", "Una tortuga con gorro de fiesta", "Un lápiz cruzando una pequeña meta", "Un libro abrazando un marcapáginas", "Una nube regando una flor", "Un zorro envuelto en una bufanda", "Un cupcake presentando una vela", "Una ballena equilibrando un barco de papel", "Un caracol entregando una tarjeta de cumpleaños", "Dos cerezas bailando juntas"],
  },
  "pt-br": {
    seoTitle: "Ideias de desenhos fáceis para bilhetes, cartões e escola | Doodle",
    seoDescription: "Veja ideias de desenhos simples para bilhetes, cartões, lancheiras, diários e sala de aula. Escolha um exemplo ou crie o seu.",
    eyebrow: "Ideias de desenhos", title: "Pequenos desenhos para momentos especiais.", description: "Copie um exemplo, abra em tamanho maior ou use a descrição para criar seu próprio desenho.", start: "Criar um desenho", viewLarger: "Ver maior", tryIdea: "Testar esta ideia", moreEyebrow: "Mais ideias", moreTitle: "Mais 20 ideias de desenhos fáceis", moreBody: "Uma boa ideia mostra um momento claro. Poucos personagens, uma ação e o desenho faz o resto.", guideTitle: "O que torna uma ideia fácil de desenhar?", guideBody: "Escolha algo conhecido, dê uma ação clara e deixe o fundo de fora quando ele não for importante. Assim, a emoção aparece mesmo com poucas linhas.", guideCta: "Transforme sua ideia em desenho", openTab: "Abrir imagem em nova aba", close: "Fechar", generator: "Gerador", browse: "Ver ideias de desenhos",
    featured: ["Uma caneca fumegante ao lado de um bilhete de agradecimento dobrado com um coração", "Um gato curioso espiando por cima de um bilhete dobrado", "Um cachorro alegre segurando um balão de aniversário", "Dois amiguinhos se abraçando sob um coração", "Uma banana corajosa com capa de super-herói", "Uma maçã e um sanduíche felizes batendo as mãos", "Um lápis ajuda uma borracha a subir em um livro escolar", "Um caracol sorridente com mochila e lápis"],
    quickIdeas: ["Um sapinho abrigado sob uma folha", "Duas meias reunidas depois da lavagem", "Uma lua sonolenta debaixo de uma nuvem", "Uma flor dando um presentinho a uma abelha", "Uma torrada dando bom-dia", "Um pinguim carregando uma caneca quente", "Um urso enviando um pequeno coração", "Uma planta feliz crescendo numa xícara", "Dois morangos dividindo um guarda-chuva", "Um filhote dormindo ao lado de um chinelo", "Uma estrela batendo a mão com a lua", "Uma tartaruga com chapéu de festa", "Um lápis cruzando uma pequena linha de chegada", "Um livro abraçando um marcador de páginas", "Uma nuvem regando uma flor", "Uma raposa enrolada num cachecol", "Um cupcake apresentando uma vela", "Uma baleia equilibrando um barco de papel", "Um caracol entregando um cartão de aniversário", "Duas cerejas dançando juntas"],
  },
  it: {
    seoTitle: "Idee per doodle facili per biglietti, note e scuola | Doodle",
    seoDescription: "Scopri idee per doodle semplici da usare su note, biglietti, pranzi, diari e a scuola. Scegli un esempio o crea il tuo.",
    eyebrow: "Idee per doodle", title: "Piccoli disegni per momenti speciali.", description: "Copia un esempio, aprilo più grande oppure usa la descrizione per creare il tuo doodle.", start: "Crea un doodle", viewLarger: "Ingrandisci", tryIdea: "Prova questa idea", moreEyebrow: "Altre idee", moreTitle: "Altre 20 idee per doodle facili", moreBody: "Una buona idea mostra un momento chiaro. Pochi personaggi, una sola azione e il disegno farà il resto.", guideTitle: "Cosa rende un’idea facile da disegnare?", guideBody: "Scegli un soggetto familiare, dagli un’azione chiara e lascia fuori lo sfondo se non serve. L’emozione resterà leggibile anche con poche linee.", guideCta: "Trasforma la tua idea in un doodle", openTab: "Apri immagine in una nuova scheda", close: "Chiudi", generator: "Generatore", browse: "Scopri le idee per doodle",
    featured: ["Una tazza fumante accanto a un biglietto di ringraziamento piegato con un cuore", "Un gatto curioso che sbircia sopra un biglietto piegato", "Un cane allegro con un palloncino di compleanno", "Due piccoli amici che si abbracciano sotto un cuore", "Una banana coraggiosa con mantello da supereroe", "Una mela e un panino felici che si danno il cinque", "Una matita aiuta una gomma a salire su un libro", "Una lumaca sorridente con zaino e matita"],
    quickIdeas: ["Una ranocchia al riparo sotto una foglia", "Due calzini riuniti dopo il bucato", "Una luna assonnata sotto una nuvola", "Un fiore regala qualcosa a un’ape", "Una fetta di pane saluta il mattino", "Un pinguino porta una tazza calda", "Un orso spedisce un piccolo cuore", "Una pianta felice cresce in una tazza", "Due fragole condividono un ombrello", "Un cucciolo dorme accanto a una ciabatta", "Una stella dà il cinque alla luna", "Una tartaruga con cappellino da festa", "Una matita supera un piccolo traguardo", "Un libro abbraccia un segnalibro", "Una nuvola annaffia un fiore", "Una volpe avvolta in una sciarpa", "Un cupcake presenta una candela", "Una balena tiene in equilibrio una barchetta", "Una lumaca consegna un biglietto di compleanno", "Due ciliegie ballano insieme"],
  },
  ja: {
    seoTitle: "メモやカードに使える簡単なイラストアイデア | Doodle",
    seoDescription: "メモ、カード、お弁当、日記、授業に使える簡単でかわいいイラストアイデア集。見本を選ぶか、自分だけの絵を作れます。",
    eyebrow: "イラストのアイデア", title: "小さな瞬間に、やさしい絵を。", description: "見本をまねして描いたり、大きく表示したり、説明文から自分のイラストを作ったりできます。", start: "イラストを作る", viewLarger: "大きく見る", tryIdea: "このアイデアを使う", moreEyebrow: "もっと見る", moreTitle: "簡単なイラストアイデアをあと20個", moreBody: "描きやすいのは、ひとつの分かりやすい瞬間です。登場するものを少なくして、動きをひとつ加えましょう。", guideTitle: "描きやすいアイデアの選び方", guideBody: "身近なものを選び、分かりやすい動きをひとつだけ加えます。背景は必要なときだけ。少ない線でも気持ちが伝わります。", guideCta: "アイデアをイラストにする", openTab: "新しいタブで画像を開く", close: "閉じる", generator: "イラスト作成", browse: "イラストアイデアを見る",
    featured: ["湯気の立つマグカップと、小さなハート付きの折りたたんだお礼メモ", "折りたたんだメモから顔をのぞかせる好奇心いっぱいの猫", "誕生日の風船をひとつ持つうれしそうな犬", "小さなハートの下で抱き合う二人の友だち", "ヒーローのマントを着けた勇敢なバナナ", "ハイタッチするりんごとサンドイッチ", "消しゴムが教科書に上がるのを手伝う鉛筆", "ランドセルと鉛筆を持つ笑顔のカタツムリ"],
    quickIdeas: ["葉っぱの下で雨宿りする小さなカエル", "洗濯のあとに再会した二足の靴下", "雲のお布団で眠る月", "ハチに小さな贈り物を渡す花", "おはようと手を振るトースト", "温かいカップを運ぶペンギン", "小さなハートを郵送するクマ", "ティーカップから育つ元気な植物", "一本の傘に入る二つのイチゴ", "片方のスリッパの横で眠る子犬", "月とハイタッチする星", "パーティーハットをかぶったカメ", "小さなゴールを走り抜ける鉛筆", "しおりを抱きしめる本", "一輪の花に水をあげる雲", "暖かいマフラーに包まれたキツネ", "一本のろうそくを差し出すカップケーキ", "紙の船を頭に乗せるクジラ", "誕生日カードを届けるカタツムリ", "一緒に踊る二つのさくらんぼ"],
  },
  ko: {
    seoTitle: "메모와 카드에 쓰기 좋은 쉬운 그림 아이디어 | Doodle",
    seoDescription: "메모, 카드, 도시락, 다이어리, 수업에 어울리는 쉽고 귀여운 그림 아이디어를 둘러보고 나만의 그림을 만들어 보세요.",
    eyebrow: "그림 아이디어", title: "작은 순간을 위한 다정한 그림.", description: "예시를 따라 그리거나 크게 열어 보세요. 설명을 그대로 사용해 나만의 그림을 만들 수도 있어요.", start: "그림 만들기", viewLarger: "크게 보기", tryIdea: "이 아이디어로 만들기", moreEyebrow: "더 많은 아이디어", moreTitle: "쉬운 그림 아이디어 20가지 더", moreBody: "좋은 아이디어는 한순간을 분명하게 보여 줘요. 등장인물은 적게, 행동은 하나만 적어 보세요.", guideTitle: "어떤 아이디어가 따라 그리기 쉬울까요?", guideBody: "익숙한 대상을 고르고 알아보기 쉬운 행동 하나를 더하세요. 꼭 필요하지 않다면 배경은 빼도 좋아요. 몇 줄만으로도 마음이 전해집니다.", guideCta: "아이디어를 그림으로 만들기", openTab: "새 탭에서 이미지 열기", close: "닫기", generator: "그림 만들기", browse: "그림 아이디어 보기",
    featured: ["김이 나는 머그잔과 작은 하트가 있는 접힌 감사 메모", "접힌 메모지 위로 얼굴을 내미는 호기심 많은 고양이", "생일 풍선 하나를 든 신난 강아지", "작은 하트 아래에서 포옹하는 두 친구", "슈퍼히어로 망토를 두른 용감한 바나나", "서로 하이파이브하는 사과와 샌드위치", "지우개가 교과서 위로 올라가도록 돕는 연필", "책가방과 연필을 든 웃는 달팽이"],
    quickIdeas: ["나뭇잎 아래에서 비를 피하는 작은 개구리", "빨래가 끝난 뒤 다시 만난 양말 한 쌍", "구름 이불을 덮고 자는 달", "벌에게 작은 선물을 건네는 꽃", "좋은 아침이라고 손 흔드는 토스트", "따뜻한 컵을 들고 가는 펭귄", "작은 하트를 우편으로 보내는 곰", "찻잔에서 자라는 행복한 식물", "우산 하나를 함께 쓰는 딸기 두 개", "슬리퍼 옆에서 잠든 강아지", "달과 하이파이브하는 별", "파티 모자를 쓴 거북이", "작은 결승선을 통과하는 연필", "책갈피를 안아 주는 책", "작은 꽃에 물을 주는 구름", "따뜻한 목도리를 두른 여우", "촛불 하나를 내미는 컵케이크", "종이배를 머리에 올린 고래", "생일 카드를 배달하는 달팽이", "함께 춤추는 체리 두 알"],
  },
  ar: {
    seoTitle: "أفكار رسومات بسيطة وسهلة للبطاقات والملاحظات | Doodle",
    seoDescription: "تصفّح أفكار رسومات بسيطة ولطيفة للملاحظات والبطاقات والدفاتر والأنشطة المدرسية، أو استخدم أي فكرة لإنشاء رسمتك الخاصة.",
    eyebrow: "أفكار للرسم", title: "أفكار رسومات بسيطة لكل مناسبة", description: "قلّد أي رسمة بيدك، أو افتحها بحجم أكبر، أو استخدم فكرتها لإنشاء رسمة جديدة.", start: "ابدأ رسمة", viewLarger: "عرض أكبر", tryIdea: "جرّب هذه الفكرة", moreEyebrow: "أفكار إضافية", moreTitle: "20 فكرة أخرى سهلة للرسم", moreBody: "أفضل الأفكار تصف لحظة واحدة واضحة. اختر شخصيات قليلة وحركة واحدة، واترك الباقي للرسمة.", guideTitle: "كيف تختار فكرة سهلة للرسم؟", guideBody: "اختر شيئًا مألوفًا وأضف إليه حركة واحدة واضحة. لا تضف خلفية إلا إذا كانت مهمة، فبضعة خطوط بسيطة تكفي لإيصال الفكرة.", guideCta: "حوّل فكرتك إلى رسمة", openTab: "فتح الصورة في علامة تبويب جديدة", close: "إغلاق", generator: "أداة الرسم", browse: "تصفّح أفكار الرسم",
    featured: ["كوب ساخن يتصاعد منه البخار بجانب رسالة شكر مطوية عليها قلب صغير", "قطة فضولية تطل من خلف ورقة مطوية", "كلب سعيد يحمل بالون عيد ميلاد واحدًا", "صديقان صغيران يتعانقان تحت قلب صغير", "موزة شجاعة ترتدي عباءة بطل خارق", "تفاحة وشطيرة تتبادلان التحية باليد", "قلم رصاص يساعد ممحاة على الصعود فوق كتاب مدرسي", "حلزون مبتسم يحمل حقيبة مدرسية وقلم رصاص"],
    quickIdeas: ["ضفدع صغير يحتمي تحت ورقة شجر", "جوربان يلتقيان من جديد بعد الغسيل", "قمر نائم تحت غيمة", "زهرة تقدم هدية صغيرة لنحلة", "شريحة خبز تلوّح بتحية الصباح", "بطريق يحمل كوبًا دافئًا", "دب يرسل قلبًا صغيرًا بالبريد", "نبتة سعيدة تنمو داخل فنجان", "حبتا فراولة تتشاركان مظلة", "جرو نائم بجانب حذاء منزلي", "نجمة تحيي القمر بيدها", "سلحفاة ترتدي قبعة احتفال", "قلم رصاص يعبر خط نهاية صغيرًا", "كتاب يعانق علامة صفحات", "غيمة تسقي زهرة صغيرة", "ثعلب يلتف بوشاح دافئ", "قطعة كعك تحمل شمعة واحدة", "حوت يوازن قاربًا ورقيًا", "حلزون يوصل بطاقة عيد ميلاد", "حبتا كرز ترقصان معًا"],
  },
};

export function getDoodleIdeas(locale: Locale): IdeasCopy {
  return IDEAS_COPY[locale];
}

export function ideasPath(locale: Locale): string {
  return `${localePath(locale) === "/" ? "" : localePath(locale)}/doodle-ideas`;
}

function ideasAlternates(): Record<string, string> {
  return Object.fromEntries([
    ...SUPPORTED_LOCALES.map((locale) => [htmlLang(locale), `${SITE_URL}${ideasPath(locale)}`]),
    ["x-default", `${SITE_URL}${ideasPath("en")}`],
  ]);
}

export function buildDoodleIdeasMetadata(locale: Locale): Metadata {
  const copy = getDoodleIdeas(locale);
  const canonical = `${SITE_URL}${ideasPath(locale)}`;
  return {
    title: copy.seoTitle,
    description: copy.seoDescription,
    alternates: { canonical, languages: ideasAlternates() },
    openGraph: { type: "website", url: canonical, siteName: "Doodle", title: copy.seoTitle, description: copy.seoDescription, locale: openGraphLocale(locale), images: [{ url: `${SITE_URL}${IDEA_IMAGES[0]}`, alt: copy.featured[0] }] },
    twitter: { card: "summary_large_image", title: copy.seoTitle, description: copy.seoDescription, images: [`${SITE_URL}${IDEA_IMAGES[0]}`] },
  };
}
