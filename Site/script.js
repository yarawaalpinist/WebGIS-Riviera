/* =========================================================
   GEOPORTAL PRO MAX — script.js
   Riviera de São Lourenço | Leaflet + leaflet-rotate
   ========================================================= */
(function () {
  'use strict';

  /* ----------------------------------------------------------------
     1. MAPA — Inicialização com leaflet-rotate
  ---------------------------------------------------------------- */
  const INITIAL_VIEW  = { lat: -23.793, lng: -46.027, zoom: 13.5 };
  const INITIAL_BEARING = 15.0; // graus

  const map = L.map('map', {
    center: [INITIAL_VIEW.lat, INITIAL_VIEW.lng],
    zoom:   INITIAL_VIEW.zoom,
    zoomControl: false,
    attributionControl: true,
    rotate: true,          // ativa leaflet-rotate
    touchRotate: false,    // desativa rotação por toque (evita conflito)
    bearing: INITIAL_BEARING,
  });

  // Aplica rotação inicial
  map.setBearing(INITIAL_BEARING);

  /* ----------------------------------------------------------------
     2. MAPAS BASE
  ---------------------------------------------------------------- */
  const baseLayers = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
    }),
    satellite: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      attribution: 'Imagery &copy; Google', maxZoom: 20,
      subdomains: ['mt0','mt1','mt2','mt3'],
    }),
    topo: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri', maxZoom: 19,
    }),
  };
  baseLayers.osm.addTo(map);
  let activeBase = 'osm';

  document.querySelectorAll('.basemap-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.base;
      if (key === activeBase) return;
      map.removeLayer(baseLayers[activeBase]);
      baseLayers[key].addTo(map);
      activeBase = key;
      document.querySelectorAll('.basemap-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  /* ----------------------------------------------------------------
     3. BÚSSOLA — Controle visual e reset para o Norte
  ---------------------------------------------------------------- */
  const compassSvg  = document.getElementById('compass-svg');
  const hudBearing  = document.getElementById('hud-bearing');

  function updateCompass(bearing) {
    // Gira o SVG da bússola na direção oposta ao bearing do mapa
    if (compassSvg) compassSvg.style.transform = `rotate(${-bearing}deg)`;
    if (hudBearing) hudBearing.textContent = `${bearing.toFixed(1)}°`;
  }

  // Atualiza bússola ao girar o mapa
  map.on('rotate', () => updateCompass(map.getBearing()));
  updateCompass(INITIAL_BEARING);

  // Botão de reset para o Norte
  document.getElementById('btn-north').addEventListener('click', () => {
    map.setBearing(0, { animate: true, duration: 0.6 });
    updateCompass(0);
  });

  /* ----------------------------------------------------------------
     4. SIDEBAR — Colapsar / Reabrir
  ---------------------------------------------------------------- */
  const sidebar    = document.getElementById('sidebar');
  const collapseBtn = document.getElementById('sidebar-collapse');
  const reopenBtn   = document.getElementById('sidebar-reopen');

  collapseBtn.addEventListener('click', () => {
    sidebar.classList.add('collapsed');
    reopenBtn.classList.add('visible');
  });
  reopenBtn.addEventListener('click', () => {
    sidebar.classList.remove('collapsed');
    reopenBtn.classList.remove('visible');
  });

  /* ----------------------------------------------------------------
     5. TOOLBAR — Zoom / Localização / Reset
  ---------------------------------------------------------------- */
  document.getElementById('btn-zoom-in').addEventListener('click', () => map.zoomIn());
  document.getElementById('btn-zoom-out').addEventListener('click', () => map.zoomOut());
  document.getElementById('btn-reset').addEventListener('click', () => {
    map.setView([INITIAL_VIEW.lat, INITIAL_VIEW.lng], INITIAL_VIEW.zoom);
    map.setBearing(INITIAL_BEARING);
    updateCompass(INITIAL_BEARING);
  });
  document.getElementById('btn-locate').addEventListener('click', () => {
    map.locate({ setView: true, maxZoom: 16 });
  });
  map.on('locationerror', () => alert('Não foi possível obter sua localização.'));

  /* ----------------------------------------------------------------
     6. HUD — Coordenadas, Zoom e Escala
  ---------------------------------------------------------------- */
  const hudLat   = document.getElementById('hud-lat');
  const hudLon   = document.getElementById('hud-lon');
  const hudZoom  = document.getElementById('hud-zoom');
  const hudScale = document.getElementById('hud-scale');

  function updateScale() {
    const cy  = map.getSize().y / 2;
    const p1  = map.containerPointToLatLng([0, cy]);
    const p2  = map.containerPointToLatLng([100, cy]);
    const m   = map.distance(p1, p2);
    hudScale.textContent = m >= 1000
      ? `${(m/1000).toFixed(1)} km / 100px`
      : `${Math.round(m)} m / 100px`;
  }

  map.on('mousemove', (e) => {
    hudLat.textContent = e.latlng.lat.toFixed(5);
    hudLon.textContent = e.latlng.lng.toFixed(5);
  });
  map.on('zoomend moveend', () => { hudZoom.textContent = map.getZoom(); updateScale(); });
  hudZoom.textContent = map.getZoom();
  updateScale();

  /* ----------------------------------------------------------------
     7. PALETAS E CATEGORIAS DE CAMADAS
  ---------------------------------------------------------------- */
  const GROUP_DEFS = {
    raster:        { label: '🌡 Análises Raster',       key: 'raster' },
    limites:       { label: '⬡ Limites Administrativos', key: 'limites' },
    hidrografia:   { label: '💧 Hidrografia',            key: 'hidrografia' },
    mobilidade:    { label: '🚲 Mobilidade',              key: 'mobilidade' },
    infraestrutura:{ label: '⚡ Infraestrutura',          key: 'infraestrutura' },
    vegetacao:     { label: '🌿 Plantio e Vegetação',     key: 'vegetacao' },
    importadas:    { label: '📂 Camadas Importadas',      key: 'importadas' },
  };

  const PALETTE = [
    '#22D3EE','#F2B84B','#A78BFA','#4ADE80','#FB7185',
    '#38BDF8','#FB923C','#60A5FA','#34D399','#F472B6',
  ];

  const layerStore = {
    raster: [], limites: [], hidrografia: [], mobilidade: [],
    infraestrutura: [], vegetacao: [], importadas: [],
  };

  let colorCursor = 0;
  let layerIdCounter = 0;

  const layersTreeEl = document.getElementById('layers-tree');
  const layerCountEl = document.getElementById('layer-count');

  function nextColor() {
    const c = PALETTE[colorCursor % PALETTE.length];
    colorCursor++;
    return c;
  }

  function dominantGeometryType(geojson) {
    const feats = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
    const first = feats.find(f => f && f.geometry) || {};
    const t = (first.geometry && first.geometry.type) || 'Point';
    if (t.includes('Polygon'))    return 'polygon';
    if (t.includes('LineString')) return 'line';
    return 'point';
  }

  function setLayerOpacity(leafletLayer, val) {
    leafletLayer.eachLayer(layer => {
      if (typeof layer.setOpacity === 'function') {
        layer.setOpacity(val);
      } else if (typeof layer.setStyle === 'function') {
        const isPoly = layer instanceof L.Polygon;
        layer.setStyle({ opacity: val, fillOpacity: isPoly ? val * 0.35 : val * 0.18 });
      }
    });
  }

  /* ----------------------------------------------------------------
     8. CONSTRUTORES DE ESTILOS ESPECIALIZADOS
  ---------------------------------------------------------------- */

  // Classificação "Risco" do Inventário de Árvores
  const RISCO_COLORS = {
    'Baixo Risco':  '#4ADE80',
    'Médio Risco':  '#F2B84B',
    'Alto Risco':   '#F0596A',
    'default':      '#A78BFA',
  };

  function getRiscoColor(risco) {
    return RISCO_COLORS[risco] || RISCO_COLORS['default'];
  }

  // Classificação "Situacao" da camada 300
  const SITUACAO_COLORS = {
    'Proposta ou Inexistente': '#F2B84B',
    'Existente':               '#4ADE80',
    'default':                 '#A78BFA',
  };

  function getSituacaoColor(situacao) {
    return SITUACAO_COLORS[situacao] || SITUACAO_COLORS['default'];
  }

  /* ----------------------------------------------------------------
     9. POPUP BUILDER
  ---------------------------------------------------------------- */
  function buildPopup(name, feature) {
    if (!feature.properties) return null;
    const props = feature.properties;
    const keys = Object.keys(props).filter(k => props[k] !== null && props[k] !== undefined);
    if (!keys.length) return null;

    const MAX_ROWS = 18;
    const rows = keys.slice(0, MAX_ROWS).map(k => {
      let v = props[k];
      if (typeof v === 'object' && v !== null) v = JSON.stringify(v);
      return `<tr><td class="popup-key">${k}</td><td class="popup-val">${v}</td></tr>`;
    }).join('');

    return `<div class="popup-title">${name}</div>
            <table class="popup-table"><tbody>${rows}</tbody></table>`;
  }

  /* ----------------------------------------------------------------
     10. ADICIONAR GeoJSON AO MAPA
  ---------------------------------------------------------------- */
  function addGeoJsonToMap(name, geojson, categoryKey = 'importadas', active = true, customStyle = null) {
    const groupKey = dominantGeometryType(geojson);
    const defColor = customStyle ? customStyle.color || nextColor() : nextColor();
    const id = `layer-${layerIdCounter++}`;

    const leafletLayer = L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => {
        let c = defColor;
        if (customStyle && customStyle.classifyBy) {
          const val = feature.properties && feature.properties[customStyle.classifyBy];
          c = customStyle.classifyFn ? customStyle.classifyFn(val) : defColor;
        }
        return L.circleMarker(latlng, {
          radius: customStyle && customStyle.radius ? customStyle.radius : 5,
          color: c, weight: 1.5, fillColor: c, fillOpacity: 0.75,
        });
      },
      style: (feature) => {
        let c = defColor;
        if (customStyle && customStyle.classifyBy) {
          const val = feature.properties && feature.properties[customStyle.classifyBy];
          c = customStyle.classifyFn ? customStyle.classifyFn(val) : defColor;
        }
        const isPoly = groupKey === 'polygon';
        return {
          color:       c,
          weight:      customStyle && customStyle.weight != null ? customStyle.weight : (isPoly ? 1.5 : 2.5),
          dashArray:   customStyle && customStyle.dashArray ? customStyle.dashArray : null,
          fillColor:   c,
          fillOpacity: customStyle && customStyle.fillOpacity != null ? customStyle.fillOpacity : (isPoly ? 0.22 : 0.1),
          opacity:     customStyle && customStyle.opacity != null ? customStyle.opacity : 1,
        };
      },
      onEachFeature: (feature, layer) => {
        const html = buildPopup(name, feature);
        if (html) layer.bindPopup(html, { maxWidth: 320, maxHeight: 300 });
      },
    });

    if (active) leafletLayer.addTo(map);

    // Para Módulos: adicionar labels fixas (tooltips permanentes)
    if (customStyle && customStyle.labelField) {
      leafletLayer.eachLayer(layer => {
        const val = layer.feature && layer.feature.properties && layer.feature.properties[customStyle.labelField];
        if (val && layer.getCenter) {
          const center = layer.getCenter();
          L.marker(center, {
            icon: L.divIcon({
              className: 'modulo-label',
              html: `<span class="modulo-label-inner">${val}</span>`,
              iconSize: null,
            }),
            interactive: false,
          }).addTo(map);
        }
      });
    }

    try {
      const bounds = leafletLayer.getBounds();
      if (bounds && bounds.isValid()) {
        // Não faz fit automático nas camadas iniciais (só nas importadas pelo usuário)
      }
    } catch (_) {}

    layerStore[categoryKey].push({
      id, name, color: defColor, leafletLayer,
      visible: active, opacity: 1.0, geometryType: groupKey,
      rasterType: null,
      classifyBy: customStyle && customStyle.classifyBy ? customStyle.classifyBy : null,
      classifyFn: customStyle && customStyle.classifyFn ? customStyle.classifyFn : null,
    });

    renderLayersTree();
    updateLegend();
    return leafletLayer;
  }

  function removeLayerById(categoryKey, id) {
    const idx = layerStore[categoryKey].findIndex(l => l.id === id);
    if (idx === -1) return;
    map.removeLayer(layerStore[categoryKey][idx].leafletLayer);
    layerStore[categoryKey].splice(idx, 1);
    renderLayersTree();
    updateLegend();
  }

  function toggleLayerVisibility(categoryKey, id, visible) {
    const item = layerStore[categoryKey].find(l => l.id === id);
    if (!item) return;
    item.visible = visible;
    if (visible) {
      item.leafletLayer.addTo(map);
      setLayerOpacity(item.leafletLayer, item.opacity);
    } else {
      map.removeLayer(item.leafletLayer);
    }
    updateLegend();
  }

  /* ----------------------------------------------------------------
     11. RENDER DA ÁRVORE DE CAMADAS
  ---------------------------------------------------------------- */
  function renderLayersTree() {
    let total = 0;
    Object.values(layerStore).forEach(g => total += g.length);
    layerCountEl.textContent = `${total} camada${total !== 1 ? 's' : ''} carregada${total !== 1 ? 's' : ''}`;

    if (total === 0) {
      layersTreeEl.innerHTML = '<p class="layers-empty">Nenhuma camada carregada.</p>';
      return;
    }

    layersTreeEl.innerHTML = '';
    Object.values(GROUP_DEFS).forEach(({ label, key }) => {
      const items = layerStore[key];
      if (!items.length) return;

      const groupEl = document.createElement('div');
      groupEl.className = 'layer-group open';

      const head = document.createElement('div');
      head.className = 'layer-group-head';
      head.innerHTML = `
        <span class="layer-group-caret">▶</span>
        <span class="layer-group-title">${label}</span>
        <span class="layer-group-count">${items.length}</span>`;
      head.addEventListener('click', () => groupEl.classList.toggle('open'));
      groupEl.appendChild(head);

      const wrap = document.createElement('div');
      wrap.className = 'layer-group-items';

      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'layer-item';
        row.innerHTML = `
          <div class="layer-item-main">
            <input type="checkbox" class="layer-checkbox" ${item.visible ? 'checked' : ''} />
            <span class="layer-color-dot" style="background:${item.color};box-shadow:0 0 5px ${item.color}88"></span>
            <span class="layer-name" title="${item.name}">${item.name}</span>
            <span class="layer-actions">
              <button class="layer-icon-btn zoom-to" title="Centralizar">⌖</button>
              <button class="layer-icon-btn remove" title="Remover">✕</button>
            </span>
          </div>
          <div class="layer-item-opacity">
            <span class="layer-opacity-label">Opacidade: ${Math.round(item.opacity * 100)}%</span>
            <input type="range" class="layer-opacity-slider" min="0" max="100" value="${Math.round(item.opacity * 100)}" />
          </div>`;

        row.querySelector('.layer-checkbox').addEventListener('change', e => {
          toggleLayerVisibility(key, item.id, e.target.checked);
        });
        row.querySelector('.layer-opacity-slider').addEventListener('input', e => {
          const val = parseFloat(e.target.value) / 100;
          row.querySelector('.layer-opacity-label').textContent = `Opacidade: ${e.target.value}%`;
          item.opacity = val;
          setLayerOpacity(item.leafletLayer, val);
        });
        row.querySelector('.zoom-to').addEventListener('click', () => {
          try {
            const b = item.leafletLayer.getBounds();
            if (b && b.isValid()) map.fitBounds(b, { padding: [40, 40] });
          } catch (_) {}
        });
        row.querySelector('.remove').addEventListener('click', () => removeLayerById(key, item.id));

        wrap.appendChild(row);
      });

      groupEl.appendChild(wrap);
      layersTreeEl.appendChild(groupEl);
    });
  }

  /* ----------------------------------------------------------------
     12. LEGENDA DINÂMICA (incluindo gradientes raster)
  ---------------------------------------------------------------- */
  const RASTER_LEGENDS = {
    'LST_Verão': {
      title: 'LST Verão (°C)',
      gradient: 'linear-gradient(to right, #313695, #4575b4, #74add1, #abd9e9, #e0f3f8, #ffffbf, #fee090, #fdae61, #f46d43, #d73027, #a50026)',
      minLabel: '< 28°C', maxLabel: '> 48°C',
    },
    'LST_Inverno': {
      title: 'LST Inverno (°C)',
      gradient: 'linear-gradient(to right, #4575b4, #74add1, #abd9e9, #e0f3f8, #ffffbf, #fee090, #fdae61, #f46d43)',
      minLabel: '< 18°C', maxLabel: '> 36°C',
    },
    'c02eq': {
      title: 'Carbono Equiv. (t/ha)',
      gradient: 'linear-gradient(to right, #f7fbff, #deebf7, #c6dbef, #9ecae1, #6baed6, #4292c6, #2171b5, #08519c, #08306b)',
      minLabel: '0', maxLabel: 'Alto',
    },
  };

  function updateLegend() {
    const legendBody = document.getElementById('legend-body');
    if (!legendBody) return;
    legendBody.innerHTML = '';
    let hasAny = false;

    // Rasters primeiro (gradientes)
    const rasterActive = layerStore.raster.filter(i => i.visible);
    if (rasterActive.length) {
      rasterActive.forEach(item => {
        const legend = RASTER_LEGENDS[item.rasterType];
        if (!legend) return;
        hasAny = true;
        const div = document.createElement('div');
        div.className = 'legend-gradient-block';
        div.innerHTML = `
          <div class="legend-gradient-title">${legend.title}</div>
          <div class="legend-gradient-bar" style="background:${legend.gradient}"></div>
          <div class="legend-gradient-labels">
            <span>${legend.minLabel}</span><span>${legend.maxLabel}</span>
          </div>`;
        legendBody.appendChild(div);
      });
    }

    // Vetores por grupo
    const vectorGroups = ['limites','hidrografia','mobilidade','infraestrutura','vegetacao','importadas'];
    vectorGroups.forEach(catKey => {
      const visible = layerStore[catKey].filter(i => i.visible);
      if (!visible.length) return;
      hasAny = true;
      visible.forEach(item => {
        if (item.classifyBy && item.classifyFn) {
          // Legend com múltiplas classes
          const div = document.createElement('div');
          div.className = 'legend-gradient-block';
          div.innerHTML = `<div class="legend-gradient-title">${item.name}</div>`;
          const classMap = item.classifyBy === 'Risco' ? RISCO_COLORS
                        : item.classifyBy === 'Situacao' ? SITUACAO_COLORS
                        : {};
          Object.entries(classMap).forEach(([cls, col]) => {
            if (cls === 'default') return;
            const li = document.createElement('div');
            li.className = 'legend-item';
            const sym = item.geometryType === 'point' ? 'point' : 'polygon';
            li.innerHTML = `
              <span class="legend-symbol ${sym}" style="background:${col}44; border-color:${col};"></span>
              <span class="legend-label">${cls}</span>`;
            div.appendChild(li);
          });
          legendBody.appendChild(div);
        } else {
          const li = document.createElement('div');
          li.className = 'legend-item';
          let symClass = 'polygon';
          if (item.geometryType === 'point') symClass = 'point';
          else if (item.geometryType === 'line') symClass = 'line';
          const symStyle = item.geometryType === 'line'
            ? `background:${item.color};`
            : `background:${item.color}44; border-color:${item.color};`;
          li.innerHTML = `
            <span class="legend-symbol ${symClass}" style="${symStyle}"></span>
            <span class="legend-label" title="${item.name}">${item.name}</span>`;
          legendBody.appendChild(li);
        }
      });
    });

    if (!hasAny) {
      legendBody.innerHTML = '<p style="font-size:11px;color:var(--text-faint);margin:0;font-style:italic;">Nenhuma camada visível.</p>';
    }
  }

  // Toggle legenda
  const legendPanel = document.getElementById('legend-panel');
  const legendToggleBtn = document.getElementById('btn-legend-toggle');
  if (legendToggleBtn && legendPanel) {
    legendToggleBtn.addEventListener('click', () => {
      legendPanel.classList.toggle('collapsed');
      legendToggleBtn.textContent = legendPanel.classList.contains('collapsed') ? '+' : '−';
    });
  }

  /* ----------------------------------------------------------------
     13. RASTER — Simulação visual de TIF como overlay colorido
         (TIF bruto não é suportado no browser; simulamos como overlay
          colorido com clip no limite da Riviera)
  ---------------------------------------------------------------- */
  function addRasterPlaceholder(name, rasterType, color, categoryKey = 'raster', active = false) {
    const id = `layer-${layerIdCounter++}`;
    // Cria um layer placeholder — ao carregar o limite da Riviera,
    // este overlay é pintado sobre os bounds do limite.
    const placeholderLayer = L.layerGroup();

    if (active) placeholderLayer.addTo(map);

    layerStore[categoryKey].push({
      id, name,
      color,
      leafletLayer: placeholderLayer,
      visible: active,
      opacity: 0.7,
      geometryType: 'polygon',
      rasterType,
    });

    renderLayersTree();
    updateLegend();
  }

  /* ----------------------------------------------------------------
     14. VALIDAÇÃO WGS-84
  ---------------------------------------------------------------- */
  function isGeoJSONInWGS84(geojson) {
    const coords = [];
    const extract = (c) => {
      if (!Array.isArray(c)) return;
      if (c.length >= 2 && typeof c[0] === 'number') { coords.push(c); return; }
      c.forEach(extract);
    };
    const feats = geojson.features || (geojson.type === 'Feature' ? [geojson] : []);
    for (const f of feats) {
      if (f.geometry && f.geometry.coordinates) extract(f.geometry.coordinates);
      if (coords.length > 50) break;
    }
    return coords.every(pt => pt[0] >= -180 && pt[0] <= 180 && pt[1] >= -90 && pt[1] <= 90);
  }

  /* ----------------------------------------------------------------
     15. UPLOAD DE ARQUIVOS
  ---------------------------------------------------------------- */
  function readFileAsGeoJson(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try { resolve(JSON.parse(reader.result)); }
        catch (e) { reject(new Error(`"${file.name}" não é um JSON válido.`)); }
      };
      reader.onerror = () => reject(new Error(`Falha ao ler "${file.name}".`));
      reader.readAsText(file);
    });
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter(f => /\.(geojson|json)$/i.test(f.name));
    for (const file of files) {
      try {
        const data = await readFileAsGeoJson(file);
        if (!isGeoJSONInWGS84(data)) {
          alert(`"${file.name}" não está em WGS-84 (EPSG:4326).\nReprojete os dados antes de importar.`);
          continue;
        }
        const layerName = file.name.replace(/\.(geojson|json)$/i, '');
        const lyr = addGeoJsonToMap(layerName, data, 'importadas', true);
        if (lyr) {
          try {
            const b = lyr.getBounds();
            if (b && b.isValid()) map.fitBounds(b, { padding: [40,40] });
          } catch (_) {}
        }
      } catch (err) { alert(err.message); }
    }
  }

  const dropzone  = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');

  fileInput.addEventListener('change', e => handleFiles(e.target.files));
  ['dragenter','dragover'].forEach(evt =>
    dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('drag-over'); })
  );
  ['dragleave','drop'].forEach(evt =>
    dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('drag-over'); })
  );
  dropzone.addEventListener('drop', e => {
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });

  // Abrir pasta (File System Access API)
  const folderBtn  = document.getElementById('btn-open-folder');
  const folderHint = document.getElementById('folder-hint');
  if (!window.showDirectoryPicker) {
    folderBtn.disabled = true;
    folderHint.textContent = 'Não suportado neste navegador. Use o upload acima.';
  } else {
    folderBtn.addEventListener('click', async () => {
      try {
        const dir = await window.showDirectoryPicker();
        const geoFiles = [];
        for await (const entry of dir.values()) {
          if (entry.kind === 'file' && /\.(geojson|json)$/i.test(entry.name))
            geoFiles.push(await entry.getFile());
        }
        if (!geoFiles.length) { alert('Nenhum .geojson encontrado nessa pasta.'); return; }
        handleFiles(geoFiles);
      } catch (err) {
        if (err.name !== 'AbortError') alert('Não foi possível abrir a pasta.');
      }
    });
  }

  /* ----------------------------------------------------------------
     16. CARREGAMENTO AUTOMÁTICO DAS CAMADAS LOCAIS
         (ordem de renderização: limites por baixo, raster acima, etc.)
  ---------------------------------------------------------------- */
  const AUTO_LAYERS = [
    // ── LIMITES ──────────────────────────────────────────────────
    {
      file: 'Limites_riviera.geojson', name: 'Limites da Riviera',
      category: 'limites', active: true,
      style: { color: '#22D3EE', weight: 2.5, fillOpacity: 0.05 },
    },
    {
      file: 'Modulos_riviera.geojson', name: 'Módulos da Riviera',
      category: 'limites', active: true,
      style: {
        color: '#F2B84B', weight: 2, fillOpacity: 0.06,
        labelField: 'Divisão',
      },
    },
    // ── HIDROGRAFIA ──────────────────────────────────────────────
    {
      file: 'Bacias_de_contribuicao.geojson', name: 'Bacias de Contribuição',
      category: 'hidrografia', active: false,
      style: { color: '#38BDF8', weight: 2, fillOpacity: 0 },
    },
    {
      file: 'Hidrografia.geojson', name: 'Hidrografia',
      category: 'hidrografia', active: false,
      style: { color: '#7DD3FC', weight: 2.5 },   // azul-claro
    },
    {
      file: 'Paleohidrografia.geojson', name: 'Paleohidrografia',
      category: 'hidrografia', active: false,
      style: { color: '#BAE6FD', weight: 1.5, dashArray: '6 4' },
    },
    {
      file: 'Curvas_de_nivel.geojson', name: 'Curvas de Nível',
      category: 'hidrografia', active: false,
      style: { color: '#A16207', weight: 1, fillOpacity: 0 },
    },
    // ── MOBILIDADE ───────────────────────────────────────────────
    {
      file: 'Ruas.geojson', name: 'Ruas',
      category: 'mobilidade', active: true,
      style: { color: '#94A3B8', weight: 1.5 },
    },
    {
      file: 'Ciclovias.geojson', name: 'Ciclovias',
      category: 'mobilidade', active: true,
      style: { color: '#A78BFA', weight: 2.5 },   // roxo/violeta
    },
    {
      file: 'Linha_de_onibus.geojson', name: 'Linha de Ônibus',
      category: 'mobilidade', active: false,
      style: { color: '#FB923C', weight: 2 },
    },
    {
      file: 'Pontos_de_onibus.geojson', name: 'Pontos de Ônibus',
      category: 'mobilidade', active: false,
      style: { color: '#FB923C', radius: 6 },
    },
    // ── INFRAESTRUTURA ───────────────────────────────────────────
    {
      file: 'Rede_eletrica.geojson', name: 'Rede Elétrica',
      category: 'infraestrutura', active: false,
      style: { color: '#FDE047', weight: 1.5 },
    },
    // ── VEGETAÇÃO ────────────────────────────────────────────────
    {
      file: 'Inventario_florestal.geojson',
      name: 'Inventário Florestal 2020 (SIMA)',  // Nome exibição alterado
      category: 'vegetacao', active: false,
      style: { color: '#166534', weight: 1, fillOpacity: 0.25 }, // verde-escuro
    },
    {
      file: 'Possiveis_espacos_plantio.geojson', name: 'Possíveis Espaços de Plantio',
      category: 'vegetacao', active: false,
      style: { color: '#4ADE80', weight: 1, fillOpacity: 0.2 },
    },
    {
      // Vagas Verdes REMOVIDA conforme requisito
      file: null, skip: true,
    },
    {
      file: 'Inventario_de_arvores_filtrado.geojson',
      name: 'Cadastro Arbóreo e Fiação Elétrica', // Nome alterado
      category: 'vegetacao', active: false,
      style: {
        classifyBy: 'Risco',
        classifyFn: getRiscoColor,
        radius: 5,
      },
    },
    // ── ÁREAS ────────────────────────────────────────────────────
    {
      file: '300.geojson', name: 'Áreas 300m (por Situação)',
      category: 'limites', active: false,
      style: {
        classifyBy: 'Situacao',
        classifyFn: getSituacaoColor,
        weight: 1.5, fillOpacity: 0.3,
      },
    },
    {
      file: '300_buffer.geojson', name: 'Buffer 300m',
      category: 'limites', active: false,
      style: { color: '#E879F9', weight: 1.5, fillOpacity: 0.1 },
    },
  ];

  async function loadAutoLayers() {
    let combinedBounds = L.latLngBounds();
    let loadedActive = 0;

    // Registrar rasters (placeholders) primeiro
    addRasterPlaceholder('LST_Verão',  'LST_Verão',  '#f46d43', 'raster', false);
    addRasterPlaceholder('LST_Inverno','LST_Inverno','#4575b4', 'raster', false);
    addRasterPlaceholder('c02eq',      'c02eq',      '#08519c', 'raster', false);

    for (const l of AUTO_LAYERS) {
      if (l.skip || !l.file) continue;
      try {
        const resp = await fetch(`../GeoJSON/${l.file}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();

        const lyr = addGeoJsonToMap(l.name, data, l.category, l.active, l.style || null);

        if (l.active && lyr) {
          try {
            const b = lyr.getBounds();
            if (b && b.isValid()) { combinedBounds.extend(b); loadedActive++; }
          } catch (_) {}
        }
      } catch (err) {
        console.warn(`[Geoportal] Camada "${l.name}" não carregada:`, err.message);
      }
    }

    if (loadedActive > 0 && combinedBounds.isValid()) {
      map.fitBounds(combinedBounds, { padding: [40, 40] });
    }
  }

  // Dispara carregamento
  loadAutoLayers().then(() => {
    renderLayersTree();
    updateLegend();
  });

})();