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
     7. COORDENADAS DE ANCORAGEM DOS RASTERS
  ---------------------------------------------------------------- */
  const TOP_LEFT     = L.latLng(-23.78716449, -46.05344352);
  const TOP_RIGHT    = L.latLng(-23.77594424, -46.00658393);
  const BOTTOM_LEFT  = L.latLng(-23.82150834, -46.04373685);

  /* ----------------------------------------------------------------
     8. PALETAS E CATEGORIAS DE CAMADAS
  ---------------------------------------------------------------- */
  const GROUP_DEFS = {
    raster:        { label: '🌡 Análises Matriciais',    key: 'raster' },
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
    independent: [], // Para "Pontos de Interesse"
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

  function setLayerOpacity(item, val) {
    item.opacity = val;
    const layer = item.leafletLayer;
    if (item.geometryType === 'raster') {
      if (typeof layer.setOpacity === 'function') {
        layer.setOpacity(val);
      }
    } else {
      layer.eachLayer(l => {
        if (typeof l.setOpacity === 'function') {
          l.setOpacity(val);
        } else if (typeof l.setStyle === 'function') {
          const isPoly = l instanceof L.Polygon;
          l.setStyle({ opacity: val, fillOpacity: isPoly ? val * 0.35 : val * 0.18 });
        }
      });
    }
  }

  /* ----------------------------------------------------------------
     9. CONSTRUTORES DE ESTILOS ESPECIALIZADOS
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
     10. POPUP BUILDER
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
     11. ADICIONAR CAMADAS AO MAPA
  ---------------------------------------------------------------- */

  // Adiciona GeoJSON
  function addGeoJsonToMap(name, geojson, categoryKey = 'importadas', active = false, customStyle = null) {
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

        if (customStyle && customStyle.labelField) {
          const val = feature.properties && feature.properties[customStyle.labelField];
          if (val) {
            layer.bindTooltip(val, {
              permanent: true,
              direction: 'center',
              className: 'modulo-label-inner-tooltip'
            });
          }
        }
      },
    });

    if (active) leafletLayer.addTo(map);

    layerStore[categoryKey].push({
      id, name, color: defColor, leafletLayer,
      visible: active, opacity: 1.0, geometryType: groupKey,
      rasterType: null,
      classifyBy: customStyle && customStyle.classifyBy ? customStyle.classifyBy : null,
      classifyFn: customStyle && customStyle.classifyFn ? customStyle.classifyFn : null,
    });

    renderLayersTree();
    return leafletLayer;
  }

  // Adiciona camada Raster processando o fundo branco (Canvas pixel manipulation)
  function addRasterOverlay(name, url, categoryKey = 'raster', active = false, rasterType = '') {
    return new Promise((resolve) => {
      const id = `layer-${layerIdCounter++}`;
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          // Torna pixels brancos puros (ou quase) totalmente transparentes
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] >= 253 && data[i+1] >= 253 && data[i+2] >= 253) {
              data[i+3] = 0;
            }
          }
          ctx.putImageData(imgData, 0, 0);
          
          const leafletLayer = L.imageOverlay.rotated(canvas, TOP_LEFT, TOP_RIGHT, BOTTOM_LEFT, {
            opacity: 0.7,
            interactive: false
          });

          if (active) leafletLayer.addTo(map);

          layerStore[categoryKey].push({
            id, name, color: '#22D3EE', leafletLayer,
            visible: active, opacity: 0.7, geometryType: 'raster',
            rasterType,
          });
        } catch (e) {
          console.warn('[Geoportal] Erro ao manipular pixels do raster:', e);
        }
        resolve();
      };
      
      img.onerror = () => {
        console.warn(`[Geoportal] Falha ao carregar raster: ${url}`);
        resolve();
      };
      
      img.src = url;
    });
  }

  // Adiciona a camada independente de Pontos de Interesse
  function addPoiLayer(geojson) {
    const id = 'layer-poi';
    const name = 'Pontos de Interesse';
    const color = '#A78BFA';

    const leafletLayer = L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => {
        return L.circleMarker(latlng, {
          radius: 6,
          color: color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.8,
        });
      },
      onEachFeature: (feature, layer) => {
        const html = buildPopup(name, feature);
        if (html) layer.bindPopup(html, { maxWidth: 320, maxHeight: 300 });

        const labelVal = feature.properties && (feature.properties.Name || feature.properties.NAME);
        if (labelVal) {
          layer.bindTooltip(labelVal, {
            permanent: true,
            direction: 'top',
            className: 'poi-label-tooltip',
            offset: L.point(0, -8),
          });
        }
      },
    });

    // Inicia desligada por padrão
    layerStore.independent.push({
      id, name, color, leafletLayer,
      visible: false, opacity: 1.0, geometryType: 'point',
      isIndependent: true,
    });

    renderLayersTree();
  }

  function removeLayerById(categoryKey, id) {
    const idx = layerStore[categoryKey].findIndex(l => l.id === id);
    if (idx === -1) return;
    map.removeLayer(layerStore[categoryKey][idx].leafletLayer);
    layerStore[categoryKey].splice(idx, 1);
    renderLayersTree();
  }

  function toggleLayerVisibility(categoryKey, id, visible) {
    const item = (categoryKey === 'independent')
      ? layerStore.independent.find(l => l.id === id)
      : layerStore[categoryKey].find(l => l.id === id);

    if (!item) return;
    item.visible = visible;
    if (visible) {
      item.leafletLayer.addTo(map);
      setLayerOpacity(item, item.opacity);
    } else {
      map.removeLayer(item.leafletLayer);
    }
    renderLayersTree();
  }

  /* ----------------------------------------------------------------
     12. RENDER DA ÁRVORE DE CAMADAS COM LEGENDAS EMBUTIDAS
  ---------------------------------------------------------------- */
  function updateGlobalLegend() {
    const legendEl = document.getElementById('global-legend');
    const contentEl = document.getElementById('legend-content');
    if (!legendEl || !contentEl) return;

    let html = '';
    let hasActive = false;

    Object.keys(layerStore).forEach(categoryKey => {
      layerStore[categoryKey].forEach(item => {
        if (!item.visible) return;
        hasActive = true;
        
        let legendItemHtml = '';

        if (item.geometryType === 'raster') {
          if (item.rasterType === 'verao' || item.rasterType === 'inverno') {
            legendItemHtml = `
              <div class="layer-legend-gradient-bar" style="background: linear-gradient(to right, #ffffc7, #fed976, #feb24c, #fd8d3c, #f03b20, #bd0026, #000000);"></div>
              <div class="layer-legend-labels"><span>22 °C</span><span>33 °C</span><span>44 °C</span></div>`;
          } else if (item.rasterType === 'c02eq') {
            legendItemHtml = `
              <div class="layer-legend-gradient-bar" style="background: linear-gradient(to right, #d7191c, #fdae61, #ffffc0, #a6d96a, #1a9641);"></div>
              <div class="layer-legend-labels"><span>-82,8368149 tCO²eq</span><span>196,4725037 tCO²eq</span></div>`;
          }
        } else if (item.classifyBy && item.classifyFn) {
          const classMap = item.classifyBy === 'Risco' ? RISCO_COLORS : item.classifyBy === 'Situacao' ? SITUACAO_COLORS : {};
          let itemsHtml = '';
          Object.entries(classMap).forEach(([cls, col]) => {
            if (cls === 'default') return;
            itemsHtml += `<div class="global-legend-symbol"><span class="global-legend-color-box" style="background:${col}"></span><span>${cls}</span></div>`;
          });
          legendItemHtml = `<div class="layer-legend-list">${itemsHtml}</div>`;
        } else {
          if (item.geometryType === 'polygon') {
            legendItemHtml = `<div class="global-legend-symbol"><span class="global-legend-color-box" style="background:${item.color}33; border-color:${item.color}"></span><span>Polígono</span></div>`;
          } else if (item.geometryType === 'line') {
            legendItemHtml = `<div class="global-legend-symbol"><span class="global-legend-color-line" style="background:${item.color}"></span><span>Linha</span></div>`;
          } else {
            legendItemHtml = `<div class="global-legend-symbol"><span class="global-legend-color-box" style="background:${item.color}; border-radius:50%"></span><span>Ponto</span></div>`;
          }
        }

        html += `
          <div class="global-legend-item">
            <span class="global-legend-title">${item.name}</span>
            ${legendItemHtml}
          </div>
        `;
      });
    });

    contentEl.innerHTML = html;
    legendEl.style.display = hasActive ? 'flex' : 'none';
  }

  function renderLayersTree() {
    let total = layerStore.independent.length;
    Object.values(layerStore).forEach(g => total += g.length);
    layerCountEl.textContent = `${total} camada${total !== 1 ? 's' : ''} carregada${total !== 1 ? 's' : ''}`;

    layersTreeEl.innerHTML = '';

    if (layerStore.independent.length > 0) {
      layerStore.independent.forEach(item => {
        const card = document.createElement('div');
        card.className = 'layer-item independent-layer-card';
        card.style.border = '1px solid rgba(255, 255, 255, 0.12)';
        card.style.borderRadius = 'var(--radius-md)';
        card.style.background = 'rgba(255, 255, 255, 0.03)';
        card.style.marginBottom = '14px';
        card.style.padding = '10px 12px';

        card.innerHTML = `
          <div class="layer-item-main">
            <input type="checkbox" class="layer-checkbox" ${item.visible ? 'checked' : ''} />
            <span class="layer-color-dot" style="background:${item.color};box-shadow:0 0 5px ${item.color}88"></span>
            <span class="layer-name" style="font-weight:700;" title="${item.name}">${item.name}</span>
            <span class="layer-actions">
              <button class="layer-icon-btn zoom-to" title="Centralizar">⌖</button>
            </span>
          </div>
          <div class="layer-item-opacity">
            <span class="layer-opacity-label">Opacidade: ${Math.round(item.opacity * 100)}%</span>
            <input type="range" class="layer-opacity-slider" min="0" max="100" value="${Math.round(item.opacity * 100)}" />
          </div>`;

        card.querySelector('.layer-checkbox').addEventListener('change', e => {
          toggleLayerVisibility('independent', item.id, e.target.checked);
        });
        card.querySelector('.layer-opacity-slider').addEventListener('input', e => {
          const val = parseFloat(e.target.value) / 100;
          card.querySelector('.layer-opacity-label').textContent = `Opacidade: ${e.target.value}%`;
          setLayerOpacity(item, val);
        });
        card.querySelector('.zoom-to').addEventListener('click', () => {
          try {
            const b = item.leafletLayer.getBounds();
            if (b && b.isValid()) map.fitBounds(b, { padding: [40, 40] });
          } catch (_) {}
        });

        layersTreeEl.appendChild(card);
      });
    }

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
          setLayerOpacity(item, val);
        });
        row.querySelector('.zoom-to').addEventListener('click', () => {
          try {
            if (item.geometryType === 'raster') {
              const bounds = L.latLngBounds([TOP_LEFT, TOP_RIGHT, BOTTOM_LEFT]);
              map.fitBounds(bounds, { padding: [40, 40] });
            } else {
              const b = item.leafletLayer.getBounds();
              if (b && b.isValid()) map.fitBounds(b, { padding: [40, 40] });
            }
          } catch (_) {}
        });
        row.querySelector('.remove').addEventListener('click', () => removeLayerById(key, item.id));

        wrap.appendChild(row);
      });

      groupEl.appendChild(wrap);
      layersTreeEl.appendChild(groupEl);
    });

    updateGlobalLegend();
  }

  /* ----------------------------------------------------------------
     13. VALIDAÇÃO WGS-84
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
     14. UPLOAD DE ARQUIVOS
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
    const files = Array.from(fileList).filter(f => /\.(geojson|json|kml|kmz)$/i.test(f.name));
    for (const file of files) {
      try {
        let data = null;
        const lowerName = file.name.toLowerCase();

        if (lowerName.endsWith('.kml')) {
          const text = await file.text();
          const dom = new DOMParser().parseFromString(text, 'text/xml');
          data = toGeoJSON.kml(dom);
        } else if (lowerName.endsWith('.kmz')) {
          const buffer = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(buffer);
          const kmlFile = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.kml'));
          if (!kmlFile) throw new Error(`Nenhum arquivo KML encontrado dentro de "${file.name}".`);
          const text = await zip.files[kmlFile].async('text');
          const dom = new DOMParser().parseFromString(text, 'text/xml');
          data = toGeoJSON.kml(dom);
        } else {
          data = await readFileAsGeoJson(file);
        }

        if (!data) continue;

        if (!isGeoJSONInWGS84(data)) {
          alert(`"${file.name}" não está em WGS-84 (EPSG:4326).\nReprojete os dados antes de importar.`);
          continue;
        }
        const layerName = file.name.replace(/\.(geojson|json|kml|kmz)$/i, '');
        const lyr = addGeoJsonToMap(layerName, data, 'importadas', true);
        if (lyr) {
          try {
            const b = lyr.getBounds();
            if (b && b.isValid()) map.fitBounds(b, { padding: [40,40] });
          } catch (_) {}
        }
      } catch (err) { alert(`Erro em "${file.name}": ` + err.message); }
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
     15. CARREGAMENTO AUTOMÁTICO DAS CAMADAS LOCAIS (TODAS DESLIGADAS)
  ---------------------------------------------------------------- */
  const AUTO_LAYERS = [
    // ── LIMITES ──────────────────────────────────────────────────
    {
      file: 'Limites_riviera.geojson', name: 'Limites da Riviera',
      category: 'limites', active: false,
      style: { color: '#22D3EE', weight: 4.0, fillOpacity: 0 },
    },
    {
      file: 'Modulos_riviera.geojson', name: 'Limites de Módulos',
      category: 'limites', active: false,
      style: {
        color: '#F2B84B', weight: 2.2, fillOpacity: 0.05,
        labelField: 'Divisão',
      },
    },
    // ── HIDROGRAFIA ──────────────────────────────────────────────
    {
      file: 'Bacias_de_contribuicao.geojson', name: 'Bacias de Contribuição',
      category: 'hidrografia', active: false,
      style: { color: '#F43F5E', weight: 4.0, fillOpacity: 0.1 },
    },
    {
      file: 'Hidrografia.geojson', name: 'Hidrografia e Rede de Drenagem',
      category: 'hidrografia', active: false,
      style: { color: '#38BDF8', weight: 2.0 },
    },
    {
      file: 'Paleohidrografia.geojson', name: 'Paleohidrografia',
      category: 'hidrografia', active: false,
      style: { color: '#BAE6FD', weight: 1.5, dashArray: '6 4' },
    },
    {
      file: 'Curvas_pol.geojson', name: 'Curvas de Nível',
      category: 'hidrografia', active: false,
      style: { color: '#A16207', weight: 1, fillOpacity: 0 },
    },
    // ── MOBILIDADE ───────────────────────────────────────────────
    {
      file: 'Ciclovias.geojson', name: 'Ciclovias',
      category: 'mobilidade', active: false,
      style: { color: '#A78BFA', weight: 2.8 },
    },
    {
      file: 'Linha_de_onibus.geojson', name: 'Linhas de Ônibus',
      category: 'mobilidade', active: false,
      style: { color: '#FB923C', weight: 2 },
    },
    {
      file: 'Pontos_de_onibus.geojson', name: 'Pontos de Ônibus',
      category: 'mobilidade', active: false,
      style: { color: '#FB923C', radius: 5 },
    },
    // ── INFRAESTRUTURA ───────────────────────────────────────────
    {
      file: 'Rede_eletrica.geojson', name: 'Rede Elétrica',
      category: 'infraestrutura', active: false,
      style: { color: '#FDE047', weight: 1.5 },
    },
    {
      file: 'Ruas_pol.geojson', name: 'Sistema Viário',
      category: 'infraestrutura', active: false,
      style: { color: '#94A3B8', weight: 1, fillOpacity: 0.15 },
    },
    // ── PLANTIO E VEGETAÇÃO ──────────────────────────────────────
    {
      file: 'Inventario_florestal.geojson',
      name: 'Inventário Florestal 2020 (SIMA)',
      category: 'vegetacao', active: false,
      style: { color: '#166534', weight: 1, fillOpacity: 0.25 },
    },
    {
      file: 'Possiveis_espacos_plantio.geojson', name: 'Possíveis Espaços de Plantio',
      category: 'vegetacao', active: false,
      style: { color: '#4ADE80', weight: 1.2, fillOpacity: 0.2 },
    },
    {
      file: 'Inventario_de_arvores_filtrado.geojson',
      name: 'Cadastro Arbóreo e Fiação Elétrica',
      category: 'vegetacao', active: false,
      style: {
        classifyBy: 'Risco',
        classifyFn: getRiscoColor,
        radius: 5,
      },
    },
    {
      file: '300.geojson', name: 'Áreas 300 m',
      category: 'vegetacao', active: false,
      style: {
        classifyBy: 'Situacao',
        classifyFn: getSituacaoColor,
        weight: 1.5, fillOpacity: 0.3,
      },
    },
    {
      file: '300_buffer.geojson', name: 'Buffer 300 m',
      category: 'vegetacao', active: false,
      style: { color: '#E879F9', weight: 1.5, fillOpacity: 0.1 },
    },
  ];

  async function loadAutoLayers() {
    let combinedBounds = L.latLngBounds();
    let loadedActive = 0;

    // 1. Carregar overlays de imagens locais aguardando o processamento
    await addRasterOverlay('Mapa de Temperatura Superficial - Verão',   './lst_verao.png',   'raster', false, 'verao');
    await addRasterOverlay('Mapa de Temperatura Superficial - Inverno', './lst_inverno.png', 'raster', false, 'inverno');
    await addRasterOverlay('Carbono Equivalente',                       './c02eq.png',       'raster', false, 'c02eq');

    // 2. Carregar camada de Pontos de Interesse (Independente)
    try {
      const respPoi = await fetch(`../GeoJSON/Pontos_de_interesse.geojson`);
      if (respPoi.ok) {
        const dataPoi = await respPoi.json();
        addPoiLayer(dataPoi);
      }
    } catch (err) {
      console.warn('[Geoportal] Falha ao carregar Pontos de Interesse:', err.message);
    }

    // 3. Carregar camadas vetoriais
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
    } else {
      // Bounding box padrão da Riviera se nenhuma camada estiver ativa no início
      map.setView([INITIAL_VIEW.lat, INITIAL_VIEW.lng], INITIAL_VIEW.zoom);
    }
  }

  // Dispara carregamento
  loadAutoLayers().then(() => {
    renderLayersTree();
  });

})();