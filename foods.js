// ============================================================
//  הגדרות ורשימת האוכל — זה הקובץ היחיד שצריך לערוך
// ============================================================

// ברירות מחדל (אפשר לשנות גם מתוך המסך ⚙️)
const SETTINGS_DEFAULT = {
  treatNights: 1,   // כמה ערבי "פינוק" (פיצה / פנקייק) מותר בשבוע
  maxItems: 6,      // כמה מנות מקסימום בצלחת אחת
};

// ה"פסים" התזונתיים. target = כמה נקודות צריך כדי שהפס יתמלא.
// הערכים לכל אוכל הם בסקאלה 0–3 (מנה של ילדה):
//   0 = אין, 1 = קצת, 2 = בסדר גמור, 3 = הרבה
const NUTRIENTS = [
  { id: 'protein',  name: 'חלבון',    emoji: '💪', target: 3, color: '#ef476f' },
  { id: 'veg',      name: 'ירקות',    emoji: '🥕', target: 3, color: '#06d6a0' },
  { id: 'energy',   name: 'אנרגיה',   emoji: '⚡', target: 3, color: '#ffb703' },
  { id: 'calcium',  name: 'סידן',     emoji: '🦴', target: 2, color: '#118ab2' },
  { id: 'vitamins', name: 'ויטמינים', emoji: '🌈', target: 3, color: '#9b5de5' },
];

const CATEGORIES = [
  { id: 'protein', name: 'חלבון',      emoji: '🍗' },
  { id: 'veg',     name: 'ירקות',      emoji: '🥗' },
  { id: 'carbs',   name: 'פחמימות',    emoji: '🍞' },
  { id: 'dairy',   name: 'חלבי',       emoji: '🧀' },
  { id: 'fruit',   name: 'פירות',      emoji: '🍎' },
  { id: 'meal',    name: 'ארוחה שלמה', emoji: '🍕' },
];

// רשימת האוכל.
//   rating : 1–5 (לבבות), אפשר גם חצאים כמו 2.5 / 4.5. null = עוד לא דירגה.
//   n      : [חלבון, ירקות, אנרגיה, סידן, ויטמינים] — לפי הסדר של NUTRIENTS
//   solo   : true = "ארוחה שלמה" — זה כל מה שיש הערב. אי אפשר לצרף אליה שום דבר,
//            ואי אפשר לבחור אותה אחרי שכבר נבחר משהו אחר. הפסים לא נדרשים בערב כזה.
//   treat  : true = ערב פינוק (פנקייק / קייזרשמרן) — נספר במכסת ערבי הפינוק השבועית.
//            פיצה היא ארוחה שלמה אבל *לא* פינוק, ולכן לא נספרת במכסה.
const FOODS = [
  // ---- ארוחות שלמות (solo) ----
  { id: 'pizza',       name: 'פיצה',               emoji: '🍕', cat: 'meal', rating: null, solo: true,              n: [1, 0, 3, 1, 0] },
  { id: 'pita-pizza',  name: 'פיתה פיצה',           emoji: '🍕', cat: 'meal', rating: null, solo: true,              n: [1, 0, 3, 1, 0] },
  { id: 'chicken',     name: 'עוף בתנור',           emoji: '🍗', cat: 'meal', rating: null, solo: true,              n: [3, 0, 0, 0, 0] },
  { id: 'meatballs',   name: 'קציצות',             emoji: '🍖', cat: 'meal', rating: null, solo: true,              n: [3, 1, 0, 0, 0] },
  { id: 'pancakes',    name: 'פנקייק',             emoji: '🥞', cat: 'meal', rating: null, solo: true, treat: true, n: [1, 0, 3, 0, 0] },
  { id: 'kaiser',      name: 'קייזרשמרן',           emoji: '🥞', cat: 'meal', rating: null, solo: true, treat: true, n: [1, 0, 3, 0, 0] },

  // ---- חלבון ----
  { id: 'schnitzel',   name: 'שניצל',              emoji: '🍗', cat: 'protein', rating: 5,    n: [3, 0, 1, 0, 0] },
  { id: 'tahini',      name: 'טחינה',              emoji: '🥣', cat: 'protein', rating: 4.5,  n: [1, 0, 0, 1, 0] },
  { id: 'scrambled',   name: 'ביצה מקושקשת',       emoji: '🍳', cat: 'protein', rating: 4,    n: [2, 0, 0, 0, 1] },
  { id: 'tuna',        name: 'טונה בשמן זית',       emoji: '🐟', cat: 'protein', rating: 4,    n: [3, 0, 0, 0, 1] },
  { id: 'corned-beef', name: 'נקניק קורנביף',       emoji: '🥩', cat: 'protein', rating: 3.5,  n: [2, 0, 0, 0, 0] },
  { id: 'pastrami',    name: 'פסטרמה',             emoji: '🥓', cat: 'protein', rating: 3.5,  n: [2, 0, 0, 0, 0] },
  { id: 'sunny-egg',   name: 'ביצת עין',           emoji: '🍳', cat: 'protein', rating: null, n: [2, 0, 0, 0, 1] },
  { id: 'soft-egg',    name: 'ביצה רכה',           emoji: '🥚', cat: 'protein', rating: null, n: [2, 0, 0, 0, 1] },
  { id: 'boiled-egg',  name: 'ביצה קשה',           emoji: '🥚', cat: 'protein', rating: null, n: [2, 0, 0, 0, 1] },
  { id: 'salmon',      name: 'סלמון',              emoji: '🐟', cat: 'protein', rating: null, n: [3, 0, 0, 0, 2] },
  { id: 'hummus',      name: 'חומוס',              emoji: '🫘', cat: 'protein', rating: null, n: [1, 0, 1, 0, 0] },
  { id: 'edamame',     name: 'אדממה',              emoji: '🫛', cat: 'protein', rating: null, n: [2, 1, 0, 0, 1] },
  { id: 'lentils',     name: 'עדשים',              emoji: '🥣', cat: 'protein', rating: null, n: [2, 0, 1, 0, 1] },

  // ---- ירקות ----
  { id: 'corn',        name: 'תירס (חנן הגנן)',     emoji: '🌽', cat: 'veg', rating: 5,    n: [0, 1, 1, 0, 1] },
  { id: 'peas',        name: 'אפונה',              emoji: '🟢', cat: 'veg', rating: 4.5,  n: [1, 2, 0, 0, 1] },
  { id: 'cuc-round',   name: 'מלפפון עיגולים',      emoji: '🥒', cat: 'veg', rating: 3,    n: [0, 2, 0, 0, 1] },
  { id: 'cuc-sticks',  name: 'מלפפון מקלות',        emoji: '🥒', cat: 'veg', rating: 2.5,  n: [0, 2, 0, 0, 1] },
  { id: 'red-pepper',  name: 'פלפל אדום',           emoji: '🫑', cat: 'veg', rating: null, n: [0, 2, 0, 0, 3] },
  { id: 'cauliflower', name: 'כרובית בתנור',        emoji: '☁️', cat: 'veg', rating: null, n: [1, 3, 0, 0, 2] },
  { id: 'cherry',      name: 'עגבניות שרי',         emoji: '🍅', cat: 'veg', rating: null, n: [0, 2, 0, 0, 2] },
  { id: 'broccoli',    name: 'ברוקולי',            emoji: '🥦', cat: 'veg', rating: null, n: [1, 3, 0, 1, 2] },
  { id: 'olives',      name: 'זיתים',              emoji: '🫒', cat: 'veg', rating: null, n: [0, 1, 0, 0, 0] },
  { id: 'salad',       name: 'סלט ישראלי',          emoji: '🥗', cat: 'veg', rating: null, n: [0, 3, 0, 0, 2] },
  { id: 'soup',        name: 'מרק ירקות',           emoji: '🍲', cat: 'veg', rating: null, n: [0, 2, 1, 0, 2] },

  // ---- פחמימות ----
  { id: 'toast',       name: 'טוסט גבינה צהובה',    emoji: '🥪', cat: 'carbs', rating: null, n: [1, 0, 2, 2, 0] },
  { id: 'potato',      name: 'תפוחי אדמה בתנור',    emoji: '🥔', cat: 'carbs', rating: null, n: [0, 0, 2, 0, 1] },
  { id: 'pasta',       name: 'פסטה',               emoji: '🍝', cat: 'carbs', rating: null, n: [0, 0, 3, 0, 0] },
  { id: 'rice',        name: 'אורז',               emoji: '🍚', cat: 'carbs', rating: 4,    n: [0, 0, 3, 0, 0] },
  { id: 'ptitim',      name: 'פתיתים',             emoji: '🍚', cat: 'carbs', rating: null, n: [0, 0, 3, 0, 0] },
  { id: 'couscous',    name: 'קוסקוס',             emoji: '🍚', cat: 'carbs', rating: null, n: [0, 0, 3, 0, 0] },
  { id: 'bread',       name: 'לחם',                emoji: '🍞', cat: 'carbs', rating: 4.5,  n: [0, 0, 2, 0, 0] },
  { id: 'pita',        name: 'פיתה',               emoji: '🫓', cat: 'carbs', rating: null, n: [0, 0, 2, 0, 0] },

  // ---- חלבי ----
  { id: 'mozzarella',  name: 'כדורי מוצרלה קטנים',  emoji: '🧀', cat: 'dairy', rating: 4,    n: [2, 0, 0, 3, 0] },
  { id: 'cottage',     name: 'גבינת קוטג׳',         emoji: '🥣', cat: 'dairy', rating: 4,    n: [2, 0, 0, 2, 0] },
  { id: 'tzfatit',     name: 'גבינה צפתית',         emoji: '🧀', cat: 'dairy', rating: 1,    n: [1, 0, 0, 2, 0] },
  { id: 'yellow',      name: 'גבינה צהובה',         emoji: '🧀', cat: 'dairy', rating: null, n: [1, 0, 0, 2, 0] },
  { id: 'white',       name: 'גבינה לבנה',          emoji: '🧀', cat: 'dairy', rating: null, n: [1, 0, 0, 2, 0] },
  { id: 'yogurt',      name: 'יוגורט',             emoji: '🥛', cat: 'dairy', rating: null, n: [1, 0, 0, 2, 0] },
  { id: 'milk',        name: 'כוס חלב',             emoji: '🥛', cat: 'dairy', rating: null, n: [1, 0, 0, 2, 0] },
  { id: 'chocmilk',    name: 'שוקו',               emoji: '🍫', cat: 'dairy', rating: null, n: [1, 0, 1, 2, 0] },

  // ---- פירות ----
  { id: 'apple',       name: 'תפוח',               emoji: '🍎', cat: 'fruit', rating: null, n: [0, 0, 1, 0, 2] },
  { id: 'banana',      name: 'בננה',               emoji: '🍌', cat: 'fruit', rating: null, n: [0, 0, 1, 0, 2] },
  { id: 'grapes',      name: 'ענבים',              emoji: '🍇', cat: 'fruit', rating: null, n: [0, 0, 1, 0, 2] },
  { id: 'strawberry',  name: 'תות',                emoji: '🍓', cat: 'fruit', rating: null, n: [0, 0, 0, 0, 2] },
  { id: 'clementine',  name: 'קלמנטינה',           emoji: '🍊', cat: 'fruit', rating: null, n: [0, 0, 0, 0, 3] },
  { id: 'melon',       name: 'מלון',               emoji: '🍈', cat: 'fruit', rating: null, n: [0, 0, 0, 0, 2] },
];
