// api-shim.js - migracion PROYECTO 1 a Supabase directo (sin servidor Node).
// Intercepta las llamadas a /api/* en la UI y las responde con Supabase.
(function () {
  if (!window.supabase || !window.supabase.createClient) return;
  const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
  const enc = new TextEncoder();
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const fetchOriginal = window.fetch;
  let logueado = false;
  window.fetch = async function (url, init) {
    const pathname = typeof url === 'string' ? url.split('?')[0] : url.url.split('?')[0];
    try {
      if (pathname.startsWith('/api/')) return await route(pathname, url, init);
    } catch (err) {
      return jsonResponse({ ok: false, error: err.message }, 500);
    }
    return fetchOriginal(url, init);
  };

  async function route(pathname, rawUrl, init) {
    const u = new URL(rawUrl, window.location.origin);
    const q = u.searchParams;
    const method = ((init && init.method) || 'GET').toUpperCase();
    const body = init && init.body ? JSON.parse(init.body) : null;

    // Plugin de login (sesion en memoria: pide clave en cada carga de pagina)
    if (method === 'POST' && pathname === '/api/login') {
      const valido = (window.ADMIN_USERS || {})[body.usuario] === body.password && Boolean(body.password);
      if (!valido) return jsonResponse({ error: 'Usuario o contrase\u00f1a incorrectos' }, 401);
      logueado = true;
      return jsonResponse({ ok: true }, 200);
    }
    if (method === 'POST' && pathname === '/api/logout') { logueado = false; return jsonResponse({ ok: true }, 200); }

    const protegida =
      pathname !== '/api/system' &&
      pathname !== '/api/login' &&
      pathname !== '/api/logout' &&
      !pathname.startsWith('/api/tienda/') &&
      !(pathname === '/api/pedidos' && method === 'POST');
    if (protegida && !logueado) return jsonResponse({ error: 'No autorizado' }, 401);

    // Config GitHub (admin)
    if (pathname === '/api/conexion') return jsonResponse({ repo: '', token: '' }, 200);

    // Sistema
    if (pathname === '/api/system') {
      const { count } = await sb.from('inventario').select('id', { count: 'exact', head: true });
      return jsonResponse({ excel: 'Supabase', totales: { productos: count || 0, unidades: 0 } }, 200);
    }
    if (method === 'POST' && pathname === '/api/reload') return jsonResponse({ ok: true }, 200);
    if (method === 'POST' && pathname.startsWith('/api/excel/upload')) return jsonResponse({ ok: false, error: 'Importacion por Excel deshabilitada en esta version; usa el importador web de Supabase.' }, 200);
    if (method === 'POST' && pathname === '/api/inventario/import') return importar(body);

    // Inventario
    if (pathname === '/api/inventario') {
      if (method === 'GET') {
        const temporada = q.get('temporada');
        const busq = (q.get('q') || '').trim();
        let items = await sb.from('inventario').select('*').order('id');
        let data = items.data || [];
        if (temporada && temporada !== 'Todos') data = data.filter(d => d.temporada === temporada);
        if (busq) data = data.filter(d => d.producto.toLowerCase().includes(busq.toLowerCase()) || (d.codigo || '').toLowerCase().includes(busq.toLowerCase()));
        return jsonResponse(data);
      }
      if (method === 'POST') {
        const { data, error } = await sb.from('inventario').insert(body).select('id').single();
        if (error) return jsonResponse({ ok: false, error: error.message }, 400);
        return jsonResponse({ ok: true, item: { id: data.id } });
      }
    }
    const invId = pathname.match(/^\/api\/inventario\/([^/]+)$/);
    if (invId) {
      const id = invId[1];
      if (method === 'PUT') {
        const { error } = await sb.from('inventario').update(body).eq('id', id);
        return jsonResponse(error ? { ok: false, error: error.message } : { ok: true });
      }
      if (method === 'DELETE') {
        const { error } = await sb.from('inventario').delete().eq('id', id);
        return jsonResponse(error ? { ok: false, error: error.message } : { ok: true });
      }
    }
    const fotoId = pathname.match(/^\/api\/inventario\/([^/]+)\/foto$/);
    if (fotoId) {
      const id = fotoId[1];
      if (method === 'PUT') {
        const foto = (body && body.base64) || null;
        const { error } = await sb.from('inventario').update({ foto }).eq('id', id);
        return jsonResponse(error ? { ok: false, error: error.message } : { ok: true });
      }
      if (method === 'DELETE') {
        const { error } = await sb.from('inventario').update({ foto: null }).eq('id', id);
        return jsonResponse(error ? { ok: false, error: error.message } : { ok: true });
      }
    }
    const invAct = pathname.match(/^\/api\/inventario\/([^/]+)\/(venta|alta|baja)$/);
    if (invAct) return ajustarStock(invAct[1], invAct[2], body);
    const invTalla = pathname.match(/^\/api\/inventario\/([^/]+)\/talla$/);
    if (invTalla && method === 'PUT') return editarTalla(invTalla[1], body);
    const invTallaDel = pathname.match(/^\/api\/inventario\/([^/]+)\/talla\/(.+)$/);
    if (invTallaDel && method === 'DELETE') return eliminarTalla(invTallaDel[1], decodeURIComponent(invTallaDel[2]));

    // Tienda
    if (pathname === '/api/tienda/catalogo') {
      const temporada = q.get('temporada');
      const busq = (q.get('q') || '').trim().toLowerCase();
      let { data } = await sb.from('inventario').select('*').order('id');
      data = (data || []).map(i => ({ ...i, tallas: (i.tallas || []).filter(t => (t.stock || 0) > 0) }))
        .filter(i => i.tallas.length > 0);
      if (temporada && temporada !== 'Todos') data = data.filter(d => d.temporada === temporada);
      if (busq) data = data.filter(d => d.producto.toLowerCase().includes(busq) || (d.codigo || '').toLowerCase().includes(busq));
      return jsonResponse(data);
    }

    // Pedidos
    if (pathname === '/api/pedidos') {
      if (method === 'GET') {
        const { data } = await sb.from('pedidos').select('*').order('id', { ascending: false });
        return jsonResponse(data || []);
      }
      if (method === 'POST') return crearPedido(body);
    }
    if (pathname === '/api/pedidos/pendientes') {
      const { data } = await sb.from('pedidos').select('*').eq('estado', 'pendiente');
      return jsonResponse({ pendientes: (data || []).length });
    }
    const pedId = pathname.match(/^\/api\/pedidos\/([^/]+)$/);
    if (pedId) {
      const id = pedId[1];
      if (method === 'DELETE') {
        const { data: pedido } = await sb.from('pedidos').select('*').eq('id', id).maybeSingle();
        if (pedido) await reponerStockPedido(pedido);
        const { error } = await sb.from('pedidos').delete().eq('id', id);
        return jsonResponse(error ? { ok: false, error: error.message } : { ok: true });
      }
    }
    const pedDesp = pathname.match(/^\/api\/pedidos\/([^/]+)\/despachar$/);
    if (pedDesp && method === 'PUT') {
      const { error } = await sb.from('pedidos').update({ estado: 'despachado', despachado: true }).eq('id', pedDesp[1]);
      return jsonResponse(error ? { ok: false, error: error.message } : { ok: true });
    }

    return jsonResponse({ ok: false, error: 'Ruta no implementada en el shim: ' + pathname }, 501);
  }

  async function ajustarStock(id, tipo, body) {
    const { data: item } = await sb.from('inventario').select('*').eq('id', id).maybeSingle();
    if (!item) return jsonResponse({ ok: false, error: 'No encontrado' }, 404);
    const indice = (item.tallas || []).findIndex(t => String(t.talla) === String(body.talla));
    if (indice < 0) return jsonResponse({ ok: false, error: 'Talla no encontrada' }, 400);
    let stock = item.tallas[indice].stock || 0;
    if (tipo === 'venta' || tipo === 'baja') stock = Math.max(0, stock - (body.cantidad || 1));
    if (tipo === 'alta') stock += (body.cantidad || 1);
    const nuevasTallas = [...item.tallas]; nuevasTallas[indice] = { ...nuevasTallas[indice], stock };
    const { error } = await sb.from('inventario').update({ tallas: nuevasTallas }).eq('id', id);
    return jsonResponse(error ? { ok: false, error: error.message } : { ok: true });
  }

  async function editarTalla(id, body) {
    const { data: item } = await sb.from('inventario').select('*').eq('id', id).maybeSingle();
    if (!item) return jsonResponse({ ok: false }, 404);
    const nuevas = (item.tallas || []).map(t => t.talla === body.anterior ? { talla: body.talla, stock: body.stock ?? t.stock } : t);
    const { error } = await sb.from('inventario').update({ tallas: nuevas }).eq('id', id);
    return jsonResponse(error ? { ok: false, error: error.message } : { ok: true });
  }
  async function eliminarTalla(id, talla) {
    const { data: item } = await sb.from('inventario').select('*').eq('id', id).maybeSingle();
    if (!item) return jsonResponse({ ok: false }, 404);
    const nuevas = (item.tallas || []).filter(t => t.talla !== talla);
    const { error } = await sb.from('inventario').update({ tallas: nuevas }).eq('id', id);
    return jsonResponse(error ? { ok: false, error: error.message } : { ok: true });
  }

  async function importar(body) {
    const lista = body.inventario || (Array.isArray(body) ? body : []);
    for (const it of lista) {
      try { await sb.from('inventario').insert(it); } catch (e) {}
    }
    return jsonResponse({ ok: true, importados: lista.length });
  }

  async function crearPedido(body) {
    const { cliente, telefono, direccion, observacion, lineas = [] } = body || {};
    let total = 0;
    const lineasFinales = [];
    for (const l of lineas) {
      const { data: item } = await sb.from('inventario').select('*').eq('id', l.id).maybeSingle();
      if (!item) return jsonResponse({ ok: false, error: 'Producto no encontrado: ' + l.id }, 400);
      const talla = (item.tallas || []).find(t => String(t.talla) === String(l.talla));
      if (!talla || talla.stock < (l.cantidad || 1)) return jsonResponse({ ok: false, error: `Stock insuficiente para ${item.producto} talla ${l.talla}` }, 400);
      const subtotal = (item.precio || 0) * (l.cantidad || 1);
      total += subtotal;
      lineasFinales.push({ id: item.id, producto: item.producto, codigo: item.codigo, temporada: item.temporada, talla: l.talla, cantidad: l.cantidad || 1, precio: item.precio, subtotal });
      talla.stock -= (l.cantidad || 1);
      const nuevasTallas = (item.tallas || []).map(t => String(t.talla) === String(talla.talla) ? { talla: t.talla, stock: talla.stock } : t);
      await sb.from('inventario').update({ tallas: nuevasTallas }).eq('id', item.id);
    }
    const { data, error } = await sb.from('pedidos').insert({ cliente, telefono, direccion, observacion, total, lineas: lineasFinales, estado: 'pendiente' }).select('id').single();
    if (error) return jsonResponse({ ok: false, error: error.message }, 400);
    return jsonResponse({ ok: true, pedido: { id: data.id } });
  }

  async function reponerStockPedido(pedido) {
    for (const l of (pedido.lineas || [])) {
      const { data: item } = await sb.from('inventario').select('*').eq('id', l.id).maybeSingle();
      if (!item) continue;
      const talla = (item.tallas || []).find(t => String(t.talla) === String(l.talla));
      if (talla) {
        talla.stock = (talla.stock || 0) + (l.cantidad || 1);
        const nuevasTallas = (item.tallas || []).map(t => t.talla === talla.talla ? { talla: t.talla, stock: talla.stock } : t);
        await sb.from('inventario').update({ tallas: nuevasTallas }).eq('id', item.id);
      }
    }
  }
})();
