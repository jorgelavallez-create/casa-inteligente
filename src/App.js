import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDyi32TmlZAY4D3C1XBUf6uz3_MlURogcE",
  authDomain: "casa-inteligente-38799.firebaseapp.com",
  projectId: "casa-inteligente-38799",
  storageBucket: "casa-inteligente-38799.firebasestorage.app",
  messagingSenderId: "213667745523",
  appId: "1:213667745523:web:15332b7caa04f1a2267186"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SEED_RECIPES = [
  { id: "r1", name: "Spaghetti a la Boloñesa", category: "pasta", kidsApproved: true, prepTime: 35, ingredients: [{ name: "Spaghetti", qty: 400, unit: "g", category: "despensa" },{ name: "Carne molida", qty: 500, unit: "g", category: "carnes" },{ name: "Tomate triturado", qty: 400, unit: "g", category: "verduras" },{ name: "Cebolla", qty: 1, unit: "pza", category: "verduras" },{ name: "Ajo", qty: 3, unit: "dientes", category: "verduras" }], tags: ["niños", "rápido"] },
  { id: "r2", name: "Pollo a la plancha con arroz", category: "pollo", kidsApproved: true, prepTime: 30, ingredients: [{ name: "Pechuga de pollo", qty: 600, unit: "g", category: "carnes" },{ name: "Arroz", qty: 300, unit: "g", category: "despensa" },{ name: "Limón", qty: 2, unit: "pza", category: "verduras" },{ name: "Aceite de oliva", qty: 50, unit: "ml", category: "despensa" }], tags: ["niños", "saludable"] },
  { id: "r3", name: "Tacos de picadillo", category: "carnes", kidsApproved: true, prepTime: 40, ingredients: [{ name: "Carne molida", qty: 400, unit: "g", category: "carnes" },{ name: "Papa", qty: 2, unit: "pza", category: "verduras" },{ name: "Zanahoria", qty: 2, unit: "pza", category: "verduras" },{ name: "Tortillas de maíz", qty: 12, unit: "pza", category: "despensa" },{ name: "Tomate", qty: 2, unit: "pza", category: "verduras" }], tags: ["niños", "mexicano"] },
  { id: "r4", name: "Enchiladas verdes", category: "mexicano", kidsApproved: false, prepTime: 50, ingredients: [{ name: "Tortillas de maíz", qty: 12, unit: "pza", category: "despensa" },{ name: "Pechuga de pollo", qty: 400, unit: "g", category: "carnes" },{ name: "Salsa verde", qty: 300, unit: "ml", category: "despensa" },{ name: "Crema", qty: 200, unit: "ml", category: "lácteos" },{ name: "Queso", qty: 150, unit: "g", category: "lácteos" }], tags: ["mexicano", "picante"] },
];

const SEED_INVENTORY = [
  { id: "i1", name: "Arroz", qty: 800, unit: "g", category: "despensa", expiry: "2025-12-01", minQty: 500 },
  { id: "i2", name: "Aceite de oliva", qty: 300, unit: "ml", category: "despensa", expiry: "2025-08-15", minQty: 200 },
  { id: "i3", name: "Spaghetti", qty: 200, unit: "g", category: "despensa", expiry: "2026-03-01", minQty: 400 },
  { id: "i4", name: "Leche", qty: 2, unit: "L", category: "lácteos", expiry: "2026-06-02", minQty: 1 },
  { id: "i5", name: "Detergente ropa", qty: 1, unit: "kg", category: "limpieza", expiry: null, minQty: 1 },
  { id: "i6", name: "Jabón trastes", qty: 500, unit: "ml", category: "limpieza", expiry: null, minQty: 300 },
  { id: "i7", name: "Papel higiénico", qty: 4, unit: "rollos", category: "limpieza", expiry: null, minQty: 6 },
  { id: "i8", name: "Pechuga de pollo", qty: 300, unit: "g", category: "carnes", expiry: "2026-05-26", minQty: 400 },
  { id: "i9", name: "Carne molida", qty: 0, unit: "g", category: "carnes", expiry: null, minQty: 400 },
  { id: "i10", name: "Tomate triturado", qty: 400, unit: "g", category: "despensa", expiry: "2026-09-01", minQty: 200 },
];

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const CATEGORY_COLORS = { despensa: "#e8a838", carnes: "#e05a4b", verduras: "#4caf7d", lácteos: "#5b9bd5", limpieza: "#9b7fd4", frutas: "#e8734a" };
const CATEGORY_ICONS = { despensa: "🥫", carnes: "🥩", verduras: "🥦", lácteos: "🥛", limpieza: "🧹", frutas: "🍎" };

function getDaysUntilExpiry(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}
function getExpiryStatus(dateStr) {
  const d = getDaysUntilExpiry(dateStr);
  if (d === null) return null;
  if (d < 0) return "expired";
  if (d <= 3) return "critical";
  if (d <= 7) return "warning";
  return "ok";
}

export default function App() {
  const [tab, setTab] = useState("planner");
  const [recipes, setRecipes] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [weekPlan, setWeekPlan] = useState({});
  const [shoppingList, setShoppingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [showAddInventory, setShowAddInventory] = useState(false);
  const [newRecipe, setNewRecipe] = useState({ name: "", kidsApproved: false, prepTime: 30, ingredients: [], tags: [] });
  const [newItem, setNewItem] = useState({ name: "", qty: "", unit: "g", category: "despensa", expiry: "", minQty: "" });
  const [checkedItems, setCheckedItems] = useState({});
  const [filterKids, setFilterKids] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [importMode, setImportMode] = useState("text");
  const [importText, setImportText] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [photoMediaType, setPhotoMediaType] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsubRecipes = onSnapshot(collection(db, "recipes"), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length === 0) { seedData(); } else { setRecipes(data); setLoading(false); }
    });
    const unsubInventory = onSnapshot(collection(db, "inventory"), snap => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubPlan = onSnapshot(doc(db, "weekPlan", "current"), snap => {
      if (snap.exists()) setWeekPlan(snap.data());
    });
    return () => { unsubRecipes(); unsubInventory(); unsubPlan(); };
  }, []);

  async function seedData() {
    const batch = writeBatch(db);
    SEED_RECIPES.forEach(r => batch.set(doc(db, "recipes", r.id), r));
    SEED_INVENTORY.forEach(i => batch.set(doc(db, "inventory", i.id), i));
    await batch.commit();
  }

  useEffect(() => {
    const needed = {};
    Object.values(weekPlan).forEach(recipe => {
      if (!recipe || !recipe.ingredients) return;
      recipe.ingredients.forEach(ing => {
        const key = ing.name.toLowerCase();
        if (!needed[key]) needed[key] = { ...ing, totalQty: 0 };
        needed[key].totalQty += ing.qty;
      });
    });
    const list = [];
    Object.values(needed).forEach(item => {
      const inStock = inventory.find(i => i.name.toLowerCase() === item.name.toLowerCase());
      const available = inStock ? inStock.qty : 0;
      const missing = item.totalQty - available;
      if (missing > 0) list.push({ ...item, needed: missing, inStock: available, source: "recetas" });
    });
    inventory.forEach(item => {
      if (item.qty < item.minQty && !list.find(l => l.name.toLowerCase() === item.name.toLowerCase())) {
        list.push({ name: item.name, unit: item.unit, category: item.category, needed: item.minQty - item.qty, inStock: item.qty, source: "stock_bajo" });
      }
    });
    setShoppingList(list);
  }, [weekPlan, inventory]);

  async function saveRecipe(recipe) {
    const id = recipe.id || `r${Date.now()}`;
    await setDoc(doc(db, "recipes", id), { ...recipe, id });
  }
  async function deleteRecipe(id) { await deleteDoc(doc(db, "recipes", id)); }
  async function saveInventoryItem(item) {
    const id = item.id || `i${Date.now()}`;
    await setDoc(doc(db, "inventory", id), { ...item, id });
  }
  async function deleteInventoryItem(id) { await deleteDoc(doc(db, "inventory", id)); }
  async function updateInventoryQty(id, delta) {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    await setDoc(doc(db, "inventory", id), { ...item, qty: Math.max(0, item.qty + delta) });
  }
  async function updateWeekPlan(newPlan) {
    setWeekPlan(newPlan);
    await setDoc(doc(db, "weekPlan", "current"), newPlan);
  }

  async function suggestWeeklyMenu() {
    setAiLoading(true); setAiMessage("");
    try {
      const inventorySummary = inventory.map(i => `${i.name}: ${i.qty}${i.unit}`).join(", ");
      const recipeList = recipes.map(r => `${r.name} (${r.kidsApproved ? "✓ niños" : "✗ niños"}, ${r.prepTime}min)`).join(", ");
      const prompt = `Sugiere un menú semanal para una familia con niños melindrosos.\n\nRecetas: ${recipeList}\nInventario: ${inventorySummary}\n\nResponde SOLO con JSON sin backticks:\n{"Lunes":"nombre","Martes":"nombre","Miércoles":"nombre","Jueves":"nombre","Viernes":"nombre","Sábado":"nombre","Domingo":"nombre"}\n\nPrioriza recetas aptas para niños entre semana. Usa solo nombres exactos de la lista.`;
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] })
      });
      const data = await response.json();
      const suggestion = JSON.parse(data.content.map(c => c.text || "").join("").trim());
      const newPlan = {};
      DAYS.forEach(day => { const found = recipes.find(r => r.name === suggestion[day]); newPlan[day] = found || null; });
      await updateWeekPlan(newPlan);
      setAiMessage("✨ ¡Menú generado y guardado para toda la familia!");
    } catch (e) { setAiMessage("Hubo un problema. Intenta de nuevo."); }
    setAiLoading(false);
  }

  async function importRecipeFromText() {
    if (!importText.trim()) return;
    setImportLoading(true); setImportResult(null); setImportError("");
    try {
      const prompt = `Extrae la información de esta receta y devuelve ÚNICAMENTE un JSON válido sin backticks.\n\nTexto:\n"""\n${importText}\n"""\n\nJSON:\n{"name":"nombre","prepTime":número,"category":"pasta|pollo|carnes|mariscos|vegetariano|sopas|ensaladas|mexicano|postres|desayunos|otro","kidsApproved":true/false,"kidsNote":"razón breve","ingredients":[{"name":"ingrediente","qty":número,"unit":"g|kg|ml|L|tsp|tbsp|pza|taza|dientes|al gusto","category":"despensa|carnes|lácteos|verduras|frutas"}],"tags":["tag"]}\n\nTraduce al español si está en inglés.`;
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] })
      });
      const data = await response.json();
      setImportResult(JSON.parse(data.content.map(c => c.text || "").join("").trim()));
    } catch (e) { setImportError("No pude interpretar la receta. Intenta con más detalle."); }
    setImportLoading(false);
  }

  function handlePhotoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 800;
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = (h * maxSize) / w; w = maxSize; }
          else { w = (w * maxSize) / h; h = maxSize; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.5);
        setPhotoBase64(compressed.split(",")[1]);
        setPhotoMediaType("image/jpeg");
        setPhotoPreview(compressed);
        setImportResult(null);
        setImportError("");
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function importRecipeFromPhoto() {
    if (!photoBase64) return;
    setImportLoading(true); setImportResult(null); setImportError("");
    try {
      const prompt = `Eres un asistente de cocina. Analiza esta imagen de una receta y extrae toda la información.\n\nDevuelve ÚNICAMENTE un JSON válido sin backticks ni markdown:\n{"name":"nombre de la receta","prepTime":número en minutos,"category":"pasta|pollo|carnes|mariscos|vegetariano|sopas|ensaladas|mexicano|postres|desayunos|otro","kidsApproved":true o false,"kidsNote":"razón breve de por qué es o no apta para niños","ingredients":[{"name":"ingrediente en español","qty":número,"unit":"g|kg|ml|L|tsp|tbsp|pza|taza|dientes|al gusto","category":"despensa|carnes|lácteos|verduras|frutas"}],"tags":["tag1","tag2"]}\n\nSi hay texto en otro idioma, tradúcelo al español. Si no puedes leer algún dato, usa valores razonables.`;
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: photoMediaType, data: photoBase64 } },
              { type: "text", text: prompt }
            ]
          }]
        })
      });
      const data = await response.json();
     const raw = data.content.map(c => c.text || "").join("").trim();
      setImportResult(JSON.parse(raw));
    } catch (e) {
      setImportError("Error: " + e.message + " | data: " + JSON.stringify(data).substring(0, 200));
    }
    setImportLoading(false);
  }

  async function confirmImport() {
    if (!importResult) return;
    await saveRecipe(importResult);
    setImportText(""); setImportResult(null); setImportError("");
    setPhotoPreview(null); setPhotoBase64(null); setPhotoMediaType(null);
    setShowImporter(false);
  }

  function resetImporter() {
    setImportText(""); setImportResult(null); setImportError("");
    setPhotoPreview(null); setPhotoBase64(null); setPhotoMediaType(null);
    setImportMode("text");
  }

  const expiringItems = inventory.filter(i => ["critical", "warning", "expired"].includes(getExpiryStatus(i.expiry)));
  const lowStockItems = inventory.filter(i => i.qty < i.minQty);

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f8f6f2", gap: 16 }}>
      <div style={{ fontSize: 40 }}>🏡</div>
      <div style={{ fontFamily: "Georgia", fontSize: 20, fontWeight: 700, color: "#2c2416" }}>Casa Inteligente</div>
      <div style={{ fontFamily: "sans-serif", color: "#888", fontSize: 14 }}>Conectando con la nube...</div>
    </div>
  );

  return (
    <div style={S.app}>
      <header style={S.header}>
        <div style={S.headerContent}>
          <div style={S.logo}>
            <span style={{ fontSize: 28 }}>🏡</span>
            <div>
              <div style={S.logoTitle}>Casa Inteligente</div>
              <div style={S.logoSub}>● familia sincronizada</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {expiringItems.length > 0 && <div style={S.alertBadge} onClick={() => setTab("inventory")}>⏰ {expiringItems.length} por vencer</div>}
            {lowStockItems.length > 0 && <div style={{ ...S.alertBadge, background: "#e8a838" }} onClick={() => setTab("shopping")}>📦 {lowStockItems.length} por acabarse</div>}
          </div>
        </div>
        <nav style={{ display: "flex", gap: 4, overflowX: "auto" }}>
          {[{ id: "planner", label: "📅 Semana" }, { id: "recipes", label: "🍳 Recetas" }, { id: "inventory", label: "📦 Inventario" }, { id: "shopping", label: `🛒 Compras${shoppingList.length > 0 ? ` (${shoppingList.length})` : ""}` }].map(t => (
            <button key={t.id} style={{ ...S.navBtn, ...(tab === t.id ? S.navBtnActive : {}) }} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
      </header>

      <main style={S.main}>
        {tab === "planner" && (
          <div>
            <div style={S.sectionHeader}>
              <div><h2 style={S.sectionTitle}>Menú de la semana</h2><p style={S.sectionSub}>Cambios visibles para toda la familia al instante</p></div>
              <button style={S.btnAI} onClick={suggestWeeklyMenu} disabled={aiLoading}>{aiLoading ? "⟳ Generando..." : "✨ Sugerir con IA"}</button>
            </div>
            {aiMessage && <div style={S.aiMessage}>{aiMessage}</div>}
            <div style={S.weekGrid}>
              {DAYS.map(day => (
                <div key={day} style={S.dayCard}>
                  <div style={S.dayName}>{day}</div>
                  {weekPlan[day] ? (
                    <div style={{ position: "relative" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginBottom: 6, fontFamily: "sans-serif" }}>{weekPlan[day].name}</div>
                      <div style={{ display: "flex", gap: 6, fontSize: 11, color: "#888", fontFamily: "sans-serif" }}>
                        <span>{weekPlan[day].prepTime}min</span>
                        {weekPlan[day].kidsApproved && <span style={S.kidsBadge}>👶</span>}
                      </div>
                      <button style={S.removeBtn} onClick={() => { const p = { ...weekPlan }; p[day] = null; updateWeekPlan(p); }}>✕</button>
                    </div>
                  ) : (
                    <select style={S.daySelect} value="" onChange={e => { const r = recipes.find(r => r.id === e.target.value); if (r) { const p = { ...weekPlan }; p[day] = r; updateWeekPlan(p); } }}>
                      <option value="">+ Agregar</option>
                      {recipes.map(r => <option key={r.id} value={r.id}>{r.kidsApproved ? "👶 " : ""}{r.name}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "recipes" && (
          <div>
            <div style={S.sectionHeader}>
              <div><h2 style={S.sectionTitle}>Recetario</h2><p style={S.sectionSub}>{recipes.length} recetas guardadas</p></div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", fontSize: 13, cursor: "pointer", fontFamily: "sans-serif" }}>
                  <input type="checkbox" checked={filterKids} onChange={e => setFilterKids(e.target.checked)} />
                  <span style={{ marginLeft: 6 }}>Solo niños 👶</span>
                </label>
                <button style={S.btnAI} onClick={() => setShowImporter(true)}>✨ Importar con IA</button>
                <button style={S.btnPrimary} onClick={() => setShowAddRecipe(true)}>+ Nueva receta</button>
              </div>
            </div>
            <div style={S.recipeGrid}>
              {recipes.filter(r => !filterKids || r.kidsApproved).map(recipe => (
                <div key={recipe.id} style={S.recipeCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{recipe.name}</div>
                    {recipe.kidsApproved && <span style={S.kidsBadge}>👶 niños</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 10, fontFamily: "sans-serif" }}>⏱ {recipe.prepTime} minutos</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                    {recipe.ingredients?.map((ing, i) => (
                      <span key={i} style={{ ...S.ingredientTag, background: (CATEGORY_COLORS[ing.category] || "#888") + "22", color: CATEGORY_COLORS[ing.category] || "#666" }}>{ing.name}</span>
                    ))}
                  </div>
                  <div style={{ borderTop: "1px solid #f0ece4", paddingTop: 10, display: "flex" }}>
                    <button style={S.btnSmall} onClick={() => { const day = DAYS.find(d => !weekPlan[d]); if (day) { const p = { ...weekPlan }; p[day] = recipe; updateWeekPlan(p); setTab("planner"); } }}>📅 Al menú</button>
                    <button style={{ ...S.btnSmall, background: "#e05a4b" }} onClick={() => deleteRecipe(recipe.id)}>🗑</button>
                  </div>
                </div>
              ))}
            </div>

            {showAddRecipe && (
              <div style={S.modal}>
                <div style={S.modalBox}>
                  <h3 style={S.modalTitle}>Nueva Receta</h3>
                  <input style={S.input} placeholder="Nombre de la receta" value={newRecipe.name} onChange={e => setNewRecipe(p => ({ ...p, name: e.target.value }))} />
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input style={{ ...S.input, flex: 1 }} type="number" placeholder="Tiempo (min)" value={newRecipe.prepTime} onChange={e => setNewRecipe(p => ({ ...p, prepTime: parseInt(e.target.value) }))} />
                    <label style={{ display: "flex", alignItems: "center", fontSize: 13, cursor: "pointer", fontFamily: "sans-serif" }}>
                      <input type="checkbox" checked={newRecipe.kidsApproved} onChange={e => setNewRecipe(p => ({ ...p, kidsApproved: e.target.checked }))} />
                      <span style={{ marginLeft: 6 }}>Apta para niños</span>
                    </label>
                  </div>
                  <p style={{ color: "#888", fontSize: 13, margin: "8px 0" }}>Ingredientes (uno por línea: nombre,cantidad,unidad,categoría)</p>
                  <textarea style={{ ...S.input, height: 100, resize: "vertical" }} placeholder={"Spaghetti,400,g,despensa\nCarne molida,500,g,carnes"}
                    onChange={e => { const ings = e.target.value.split("\n").map(line => { const [name, qty, unit, category] = line.split(","); return { name: name?.trim(), qty: parseFloat(qty) || 0, unit: unit?.trim() || "g", category: category?.trim() || "despensa" }; }).filter(i => i.name); setNewRecipe(p => ({ ...p, ingredients: ings })); }} />
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                    <button style={S.btnSecondary} onClick={() => setShowAddRecipe(false)}>Cancelar</button>
                    <button style={S.btnPrimary} onClick={async () => { if (!newRecipe.name) return; await saveRecipe(newRecipe); setNewRecipe({ name: "", kidsApproved: false, prepTime: 30, ingredients: [], tags: [] }); setShowAddRecipe(false); }}>Guardar</button>
                  </div>
                </div>
              </div>
            )}

            {showImporter && (
              <div style={S.modal}>
                <div style={{ ...S.modalBox, maxWidth: 560 }}>
                  <h3 style={S.modalTitle}>✨ Importar receta con IA</h3>

                  {!importResult && (
                    <div style={{ display: "flex", gap: 0, marginBottom: 16, border: "1px solid #e0dbd0", borderRadius: 8, overflow: "hidden" }}>
                      <button
                        style={{ flex: 1, padding: "10px 0", border: "none", cursor: "pointer", fontSize: 14, fontFamily: "sans-serif", fontWeight: importMode === "text" ? 700 : 400, background: importMode === "text" ? "#2c2416" : "white", color: importMode === "text" ? "#e8a838" : "#666", transition: "all 0.2s" }}
                        onClick={() => { setImportMode("text"); setImportError(""); setImportResult(null); }}
                      >📝 Pegar texto</button>
                      <button
                        style={{ flex: 1, padding: "10px 0", border: "none", borderLeft: "1px solid #e0dbd0", cursor: "pointer", fontSize: 14, fontFamily: "sans-serif", fontWeight: importMode === "photo" ? 700 : 400, background: importMode === "photo" ? "#2c2416" : "white", color: importMode === "photo" ? "#e8a838" : "#666", transition: "all 0.2s" }}
                        onClick={() => { setImportMode("photo"); setImportError(""); setImportResult(null); }}
                      >📸 Subir foto</button>
                    </div>
                  )}

                  {importMode === "text" && !importResult && !importLoading && (
                    <>
                      <p style={{ color: "#666", fontSize: 13, margin: "0 0 12px", fontFamily: "sans-serif", lineHeight: 1.5 }}>Pega o escribe la receta en cualquier formato. La IA la interpreta y la guarda para toda la familia.</p>
                      <textarea style={{ ...S.input, height: 160, resize: "vertical", fontSize: 13 }} placeholder={"Pollo al horno\n- 4 pechugas\n- 3 papas\n- Aceite al gusto\nHornear 40 min a 180°C"} value={importText} onChange={e => { setImportText(e.target.value); setImportResult(null); setImportError(""); }} />
                      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                        <button style={S.btnSecondary} onClick={() => { setShowImporter(false); resetImporter(); }}>Cancelar</button>
                        <button style={S.btnAI} onClick={importRecipeFromText} disabled={!importText.trim()}>✨ Interpretar</button>
                      </div>
                    </>
                  )}

                  {importMode === "photo" && !importResult && !importLoading && (
                    <>
                      <p style={{ color: "#666", fontSize: 13, margin: "0 0 12px", fontFamily: "sans-serif", lineHeight: 1.5 }}>Sube una foto de la receta — de un libro, revista, pantalla, lo que sea. La IA la lee y extrae todo.</p>
                      <div
                        style={{ border: "2px dashed #e0dbd0", borderRadius: 10, padding: photoPreview ? 0 : "32px 16px", textAlign: "center", cursor: "pointer", marginBottom: 12, overflow: "hidden", background: photoPreview ? "black" : "#fafaf8", transition: "all 0.2s" }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {photoPreview ? (
                          <img src={photoPreview} alt="Receta" style={{ width: "100%", maxHeight: 260, objectFit: "contain", display: "block" }} />
                        ) : (
                          <>
                            <div style={{ fontSize: 36, marginBottom: 8 }}>📸</div>
                            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "sans-serif", color: "#2c2416", marginBottom: 4 }}>Toca para seleccionar foto</div>
                            <div style={{ fontSize: 12, color: "#aaa", fontFamily: "sans-serif" }}>JPG, PNG — desde tu galería o cámara</div>
                          </>
                        )}
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoSelect} />

                      {photoPreview && (
                        <div style={{ fontSize: 12, color: "#888", fontFamily: "sans-serif", marginBottom: 12, textAlign: "center" }}>
                          ✅ Foto lista — <span style={{ color: "#e05a4b", cursor: "pointer", textDecoration: "underline" }} onClick={() => { setPhotoPreview(null); setPhotoBase64(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>cambiar</span>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                        <button style={S.btnSecondary} onClick={() => { setShowImporter(false); resetImporter(); }}>Cancelar</button>
                        <button style={S.btnAI} onClick={importRecipeFromPhoto} disabled={!photoBase64}>✨ Analizar foto</button>
                      </div>
                    </>
                  )}

                  {importLoading && (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#888", fontFamily: "sans-serif" }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>{importMode === "photo" ? "🔍" : "⟳"}</div>
                      <div>{importMode === "photo" ? "Leyendo la receta de la foto..." : "Analizando la receta..."}</div>
                    </div>
                  )}

                  {importError && <div style={{ background: "#e05a4b15", border: "1px solid #e05a4b", borderRadius: 8, padding: "10px 14px", color: "#e05a4b", fontSize: 13, fontFamily: "sans-serif", marginTop: 10 }}>{importError}</div>}

                  {importResult && (
                    <div style={{ background: "#f8f6f2", borderRadius: 10, padding: 16, marginTop: 10 }}>
                      <div style={{ fontSize: 13, color: "#888", fontFamily: "sans-serif", marginBottom: 8 }}>✅ Revisa y confirma:</div>
                      <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>{importResult.name}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        <span style={{ ...S.kidsBadge, background: importResult.kidsApproved ? "#4caf7d22" : "#e05a4b22", color: importResult.kidsApproved ? "#4caf7d" : "#e05a4b" }}>{importResult.kidsApproved ? "👶 Apta para niños" : "⚠️ No apta para niños"}</span>
                        {importResult.kidsNote && <span style={{ fontSize: 12, color: "#888", fontFamily: "sans-serif", alignSelf: "center" }}>{importResult.kidsNote}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: "#666", marginBottom: 8, fontFamily: "sans-serif" }}>⏱ {importResult.prepTime} min • {importResult.category}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                        {importResult.ingredients?.map((ing, i) => <span key={i} style={{ ...S.ingredientTag, background: (CATEGORY_COLORS[ing.category] || "#888") + "22", color: CATEGORY_COLORS[ing.category] || "#666" }}>{ing.name} {ing.qty} {ing.unit}</span>)}
                      </div>
                      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
                        <button style={S.btnSecondary} onClick={() => setImportResult(null)}>Corregir</button>
                        <button style={S.btnPrimary} onClick={confirmImport}>✓ Guardar en la nube</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "inventory" && (
          <div>
            <div style={S.sectionHeader}>
              <div><h2 style={S.sectionTitle}>Inventario del hogar</h2><p style={S.sectionSub}>{inventory.length} productos registrados</p></div>
              <button style={S.btnPrimary} onClick={() => setShowAddInventory(true)}>+ Agregar producto</button>
            </div>
            {expiringItems.length > 0 && (
              <div style={{ background: "#fff8f0", border: "1px solid #e8a838", borderRadius: 8, padding: "12px 16px", marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 13, fontFamily: "sans-serif" }}>
                <strong>⚠️ Productos con alerta:</strong>
                {expiringItems.map(i => { const days = getDaysUntilExpiry(i.expiry); const status = getExpiryStatus(i.expiry); return <span key={i.id} style={{ color: "white", padding: "2px 8px", borderRadius: 10, fontSize: 12, background: status === "expired" ? "#e05a4b" : status === "critical" ? "#e8734a" : "#e8a838" }}>{i.name}: {days < 0 ? "vencido" : `${days}d`}</span>; })}
              </div>
            )}
            {["despensa", "carnes", "lácteos", "verduras", "frutas", "limpieza"].map(cat => {
              const catItems = inventory.filter(i => i.category === cat);
              if (catItems.length === 0) return null;
              return (
                <div key={cat} style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontWeight: 700, fontSize: 15 }}>
                    <span>{CATEGORY_ICONS[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                    <span style={{ fontSize: 12, color: "#888", fontFamily: "sans-serif", fontWeight: 400 }}>{catItems.length} productos</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                    {catItems.map(item => {
                      const pct = Math.min(100, (item.qty / (item.minQty * 2)) * 100);
                      const status = getExpiryStatus(item.expiry);
                      const isLow = item.qty < item.minQty;
                      return (
                        <div key={item.id} style={{ background: "white", borderRadius: 8, padding: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.05)", borderLeft: `3px solid ${isLow ? "#e05a4b" : CATEGORY_COLORS[cat] || "#ccc"}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</span>
                            {isLow && <span style={{ background: "#e05a4b20", color: "#e05a4b", padding: "1px 6px", borderRadius: 8, fontSize: 10, fontFamily: "sans-serif" }}>⬇ bajo</span>}
                            {status === "critical" && <span style={{ background: "#e8734a20", color: "#e8734a", padding: "1px 6px", borderRadius: 8, fontSize: 10, fontFamily: "sans-serif" }}>⏰ {getDaysUntilExpiry(item.expiry)}d</span>}
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#2c2416", marginBottom: 6 }}>{item.qty} {item.unit}</div>
                          <div style={{ height: 4, background: "#f0ece4", borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                            <div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, background: isLow ? "#e05a4b" : CATEGORY_COLORS[cat] || "#4caf7d" }} />
                          </div>
                          {item.expiry && <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontFamily: "sans-serif" }}>Vence: {item.expiry}</div>}
                          <div style={{ display: "flex", gap: 4 }}>
                            <button style={S.btnTiny} onClick={() => updateInventoryQty(item.id, -1)}>−</button>
                            <button style={S.btnTiny} onClick={() => updateInventoryQty(item.id, 1)}>+</button>
                            <button style={{ ...S.btnTiny, color: "#e05a4b" }} onClick={() => deleteInventoryItem(item.id)}>🗑</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {showAddInventory && (
              <div style={S.modal}>
                <div style={S.modalBox}>
                  <h3 style={S.modalTitle}>Agregar al inventario</h3>
                  <input style={S.input} placeholder="Nombre del producto" value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} />
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input style={{ ...S.input, flex: 1 }} type="number" placeholder="Cantidad" value={newItem.qty} onChange={e => setNewItem(p => ({ ...p, qty: parseFloat(e.target.value) || 0 }))} />
                    <input style={{ ...S.input, width: 80 }} placeholder="Unidad" value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))} />
                  </div>
                  <select style={S.input} value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}>
                    {["despensa", "carnes", "lácteos", "verduras", "frutas", "limpieza"].map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
                  </select>
                  <input style={S.input} type="date" value={newItem.expiry} onChange={e => setNewItem(p => ({ ...p, expiry: e.target.value }))} />
                  <input style={S.input} type="number" placeholder="Mínimo recomendado (alertas)" value={newItem.minQty} onChange={e => setNewItem(p => ({ ...p, minQty: parseFloat(e.target.value) || 0 }))} />
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                    <button style={S.btnSecondary} onClick={() => setShowAddInventory(false)}>Cancelar</button>
                    <button style={S.btnPrimary} onClick={async () => { if (!newItem.name) return; await saveInventoryItem(newItem); setNewItem({ name: "", qty: "", unit: "g", category: "despensa", expiry: "", minQty: "" }); setShowAddInventory(false); }}>Guardar</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "shopping" && (
          <div>
            <div style={S.sectionHeader}>
              <div><h2 style={S.sectionTitle}>Lista de compras</h2><p style={S.sectionSub}>Generada del menú e inventario</p></div>
              <button style={S.btnSecondary} onClick={() => setCheckedItems({})}>Limpiar checks</button>
            </div>
            {shoppingList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#666", fontFamily: "sans-serif" }}>
                <div style={{ fontSize: 48 }}>✅</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginTop: 12 }}>¡Todo está completo!</div>
                <div style={{ color: "#888", marginTop: 6 }}>El inventario cubre el menú de la semana.</div>
              </div>
            ) : (
              <>
                <div style={{ background: "white", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#666", fontFamily: "sans-serif", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                  {shoppingList.length} productos necesarios • {Object.values(checkedItems).filter(Boolean).length} ya en el carrito
                </div>
                {["despensa", "carnes", "lácteos", "verduras", "frutas", "limpieza"].map(cat => {
                  const catItems = shoppingList.filter(i => i.category === cat);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat} style={{ background: "white", borderRadius: 10, overflow: "hidden", marginBottom: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                      <div style={{ padding: "10px 16px", fontWeight: 700, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center", background: (CATEGORY_COLORS[cat] || "#888") + "15", borderLeft: `4px solid ${CATEGORY_COLORS[cat] || "#ccc"}` }}>
                        {CATEGORY_ICONS[cat] || "📦"} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        <span style={{ fontSize: 12, color: "#888", fontFamily: "sans-serif", fontWeight: 400 }}>{catItems.length} items</span>
                      </div>
                      {catItems.map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: "1px solid #f5f2ee", opacity: checkedItems[`${cat}-${item.name}`] ? 0.4 : 1 }}>
                          <input type="checkbox" checked={!!checkedItems[`${cat}-${item.name}`]} onChange={e => setCheckedItems(p => ({ ...p, [`${cat}-${item.name}`]: e.target.checked }))} style={{ width: 16, height: 16, cursor: "pointer" }} />
                          <div style={{ flex: 1, display: "flex", justifyContent: "space-between", fontFamily: "sans-serif", fontSize: 14 }}>
                            <span style={{ textDecoration: checkedItems[`${cat}-${item.name}`] ? "line-through" : "none", fontWeight: 500 }}>{item.name}</span>
                            <span style={{ color: "#888", fontSize: 13 }}>{item.needed} {item.unit}</span>
                          </div>
                          <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontFamily: "sans-serif", background: item.source === "recetas" ? "#4caf7d22" : "#e8a83822", color: item.source === "recetas" ? "#4caf7d" : "#e8a838" }}>
                            {item.source === "recetas" ? "📅 menú" : "📦 stock"}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const S = {
  app: { minHeight: "100vh", background: "#f8f6f2", fontFamily: "'Georgia', serif", color: "#2c2416" },
  header: { background: "#2c2416", color: "#f8f6f2", padding: "0 20px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 20px rgba(0,0,0,0.3)" },
  headerContent: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 10px" },
  logo: { display: "flex", alignItems: "center", gap: 12 },
  logoTitle: { fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px" },
  logoSub: { fontSize: 11, color: "#4caf7d", textTransform: "uppercase", letterSpacing: 1 },
  alertBadge: { background: "#e05a4b", color: "white", padding: "5px 10px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "sans-serif" },
  navBtn: { background: "transparent", border: "none", color: "#b8a898", padding: "10px 16px", cursor: "pointer", fontSize: 14, borderBottom: "3px solid transparent", transition: "all 0.2s", whiteSpace: "nowrap", fontFamily: "sans-serif" },
  navBtnActive: { color: "#e8a838", borderBottomColor: "#e8a838" },
  main: { maxWidth: 900, margin: "0 auto", padding: "24px 16px" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 },
  sectionTitle: { fontSize: 24, fontWeight: 700, margin: 0 },
  sectionSub: { color: "#888", fontSize: 14, margin: "4px 0 0", fontFamily: "sans-serif" },
  btnAI: { background: "linear-gradient(135deg, #2c2416, #4a3a26)", color: "#e8a838", border: "1px solid #e8a838", padding: "10px 18px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontFamily: "sans-serif", fontWeight: 600 },
  btnPrimary: { background: "#2c2416", color: "#e8a838", border: "none", padding: "10px 18px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontFamily: "sans-serif", fontWeight: 600 },
  btnSecondary: { background: "transparent", color: "#2c2416", border: "1px solid #2c2416", padding: "10px 18px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontFamily: "sans-serif" },
  btnSmall: { background: "#2c2416", color: "#e8a838", border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "sans-serif", marginRight: 6 },
  btnTiny: { background: "#f0ece4", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 12 },
  aiMessage: { background: "#e8a83822", border: "1px solid #e8a838", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 14, fontFamily: "sans-serif", color: "#7a5a1a" },
  weekGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 },
  dayCard: { background: "white", borderRadius: 10, padding: 12, boxShadow: "0 1px 8px rgba(0,0,0,0.06)", minHeight: 100 },
  dayName: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#e8a838", marginBottom: 8, fontFamily: "sans-serif" },
  kidsBadge: { background: "#4caf7d22", color: "#4caf7d", padding: "2px 6px", borderRadius: 10, fontSize: 11, fontFamily: "sans-serif" },
  removeBtn: { position: "absolute", top: -4, right: -4, background: "#e05a4b", color: "white", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", fontSize: 10 },
  daySelect: { width: "100%", border: "1px dashed #ddd", borderRadius: 6, padding: "6px 4px", fontSize: 12, color: "#888", background: "#fafafa", cursor: "pointer", fontFamily: "sans-serif" },
  recipeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 },
  recipeCard: { background: "white", borderRadius: 12, padding: 16, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" },
  ingredientTag: { padding: "2px 8px", borderRadius: 10, fontSize: 11, fontFamily: "sans-serif" },
  modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 },
  modalBox: { background: "white", borderRadius: 14, padding: 24, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto" },
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 16, marginTop: 0 },
  input: { width: "100%", border: "1px solid #e0dbd0", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "sans-serif", marginBottom: 10, boxSizing: "border-box", background: "#fafaf8" },
};
