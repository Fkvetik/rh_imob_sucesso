-- ============================================================
-- REVERT: recalcula metrô das 45 mil marcadas GEO_GENERICA
-- a partir das coordenadas (lat/lng) que ainda existem.
-- Estações derivadas dos registros com geo preciso (metro_status=OK).
-- Marca como GEO_APROX (impreciso, centróide) para conserto futuro.
-- ============================================================

with est(nome, lat, lng, linha, cor) as (
  values
    ('Campo Limpo',-23.640161,-46.769495,'Linha 5-Lilás','Lilás'),
    ('Jabaquara',-23.663706,-46.63666,'Linha 1-Azul','Azul'),
    ('Oratório',-23.579896,-46.56413,'Linha 15-Prata','Prata'),
    ('Vila Sônia',-23.518475,-46.878173,'Linha 4-Amarela','Amarela'),
    ('Vila União',-23.589919,-46.512066,'Linha 15-Prata','Prata'),
    ('Tamanduateí',-23.600299,-46.583591,'Linha 2-Verde','Verde'),
    ('Brás',-23.557314,-46.615355,'Linha 3-Vermelha','Vermelha'),
    ('Vila Tolstói',-23.600384,-46.526429,'Linha 15-Prata','Prata'),
    ('Parada Inglesa',-23.494814,-46.599965,'Linha 1-Azul','Azul'),
    ('Jardim Colonial',-23.597651,-46.45044,'Linha 15-Prata','Prata'),
    ('São Mateus',-23.62539,-46.459488,'Linha 15-Prata','Prata'),
    ('Penha',-23.525403,-46.547706,'Linha 3-Vermelha','Vermelha'),
    ('Higienópolis-Mackenzie',-23.552633,-46.649964,'Linha 4-Amarela','Amarela'),
    ('Vila das Belezas',-23.636039,-46.747438,'Linha 5-Lilás','Lilás'),
    ('Marechal Deodoro',-23.532044,-46.655407,'Linha 3-Vermelha','Vermelha'),
    ('Adolfo Pinheiro',-23.663319,-46.684986,'Linha 5-Lilás','Lilás'),
    ('Corinthians-Itaquera',-23.537284,-46.452726,'Linha 3-Vermelha','Vermelha'),
    ('Patriarca-Vila Ré',-23.514887,-46.493885,'Linha 3-Vermelha','Vermelha'),
    ('Guilhermina-Esperança',-23.516027,-46.515776,'Linha 3-Vermelha','Vermelha'),
    ('Pedro II',-23.555022,-46.6227,'Linha 3-Vermelha','Vermelha'),
    ('Ana Rosa',-23.582689,-46.637518,'Linha 1-Azul / Linha 2-Verde','Azul'),
    ('Japão-Liberdade',-23.556368,-46.636194,'Linha 1-Azul','Azul'),
    ('Artur Alvim',-23.54345,-46.485794,'Linha 3-Vermelha','Vermelha'),
    ('Santo Amaro',-23.682153,-46.720241,'Linha 5-Lilás','Lilás'),
    ('Vila Matilde',-23.530399,-46.531127,'Linha 3-Vermelha','Vermelha'),
    ('Carrão',-23.535931,-46.563126,'Linha 3-Vermelha','Vermelha'),
    ('Jardim Planalto',-23.601735,-46.504418,'Linha 15-Prata','Prata'),
    ('Campo Belo',-23.616606,-46.6837,'Linha 5-Lilás','Lilás'),
    ('Palmeiras-Barra Funda',-23.502458,-46.682618,'Linha 3-Vermelha','Vermelha'),
    ('Tatuapé',-23.541667,-46.576769,'Linha 3-Vermelha','Vermelha'),
    ('Fazenda da Juta',-23.608451,-46.489766,'Linha 15-Prata','Prata'),
    ('Vila Madalena',-23.529664,-46.703689,'Linha 2-Verde','Verde'),
    ('Alto do Ipiranga',-23.611625,-46.614151,'Linha 2-Verde','Verde'),
    ('Belém',-23.543943,-46.592809,'Linha 3-Vermelha','Vermelha'),
    ('Giovanni Gronchi',-23.644013,-46.734311,'Linha 5-Lilás','Lilás'),
    ('Sacomã',-23.616613,-46.595612,'Linha 2-Verde','Verde'),
    ('Faria Lima',-23.568191,-46.693114,'Linha 4-Amarela','Amarela'),
    ('Santa Cecília',-23.538657,-46.649767,'Linha 3-Vermelha','Vermelha'),
    ('Tucuruvi',-23.398432,-46.617256,'Linha 1-Azul','Azul'),
    ('São Judas',-23.626458,-46.636177,'Linha 1-Azul','Azul'),
    ('Santos-Imigrantes',-23.596682,-46.621056,'Linha 2-Verde','Verde'),
    ('Vila Prudente',-23.579077,-46.584192,'Linha 2-Verde / Linha 15-Prata','Verde'),
    ('República',-23.542631,-46.643564,'Linha 3-Vermelha / Linha 4-Amarela','Vermelha'),
    ('Chácara Klabin',-23.592657,-46.628236,'Linha 2-Verde / Linha 5-Lilás','Verde'),
    ('Santa Cruz',-23.59803,-46.636349,'Linha 1-Azul / Linha 5-Lilás','Azul'),
    ('Saúde',-23.617778,-46.640898,'Linha 1-Azul','Azul'),
    ('São Lucas',-23.57544,-46.533992,'Linha 15-Prata','Prata'),
    ('Portuguesa-Tietê',-23.518122,-46.603983,'Linha 1-Azul','Azul'),
    ('Trianon-Masp',-23.561723,-46.654036,'Linha 2-Verde','Verde'),
    ('Bresser-Mooca',-23.54324,-46.604035,'Linha 3-Vermelha','Vermelha'),
    ('Capão Redondo',-23.674951,-46.830179,'Linha 5-Lilás','Lilás'),
    ('Santana',-23.495107,-46.641279,'Linha 1-Azul','Azul'),
    ('Borba Gato',-23.643536,-46.678851,'Linha 5-Lilás','Lilás'),
    ('Jardim São Paulo-Ayrton Senna',-23.477696,-46.63488,'Linha 1-Azul','Azul'),
    ('Conceição',-23.634803,-46.630544,'Linha 1-Azul','Azul'),
    ('Camilo Haddad',-23.597007,-46.542959,'Linha 15-Prata','Prata'),
    ('Vergueiro',-23.569551,-46.631291,'Linha 1-Azul','Azul'),
    ('Sumaré',-23.540907,-46.675083,'Linha 2-Verde','Verde'),
    ('Brooklin',-23.623004,-46.69101,'Linha 5-Lilás','Lilás'),
    ('Sapopemba',-23.621847,-46.503403,'Linha 15-Prata','Prata'),
    ('Consolação',-23.555743,-46.658179,'Linha 2-Verde','Verde'),
    ('São Joaquim',-23.561631,-46.636782,'Linha 1-Azul','Azul'),
    ('Largo Treze',-23.685685,-46.700392,'Linha 5-Lilás','Lilás'),
    ('São Paulo-Morumbi',-23.583886,-46.722024,'Linha 4-Amarela','Amarela'),
    ('Butantã',-23.565503,-46.724381,'Linha 4-Amarela','Amarela'),
    ('Hospital São Paulo',-23.596492,-46.6457,'Linha 5-Lilás','Lilás'),
    ('Fradique Coutinho',-23.563736,-46.685361,'Linha 4-Amarela','Amarela'),
    ('Clínicas',-23.551717,-46.666694,'Linha 2-Verde','Verde'),
    ('Paulista',-23.555138,-46.661699,'Linha 4-Amarela','Amarela'),
    ('Luz',-23.537373,-46.636049,'Linha 1-Azul / Linha 4-Amarela','Azul'),
    ('Vila Mariana',-23.587066,-46.630911,'Linha 1-Azul','Azul'),
    ('Oscar Freire',-23.561037,-46.669959,'Linha 4-Amarela','Amarela'),
    ('Moema',-23.597773,-46.668153,'Linha 5-Lilás','Lilás'),
    ('Alto da Boa Vista',-23.63941,-46.696401,'Linha 5-Lilás','Lilás'),
    ('Carandiru',-23.509424,-46.605606,'Linha 1-Azul','Azul'),
    ('AACD-Servidor',-23.593777,-46.651558,'Linha 5-Lilás','Lilás'),
    ('Eucaliptos',-23.608058,-46.671043,'Linha 5-Lilás','Lilás'),
    ('Brigadeiro',-23.56489,-46.647458,'Linha 2-Verde','Verde'),
    ('Tiradentes',-23.524496,-46.641836,'Linha 1-Azul','Azul'),
    ('Anhangabaú',-23.551054,-46.642541,'Linha 3-Vermelha','Vermelha'),
    ('Armênia',-23.52504,-46.628027,'Linha 1-Azul','Azul'),
    ('Praça da Árvore',-23.608479,-46.633227,'Linha 1-Azul','Azul'),
    ('Sé',-23.551357,-46.630601,'Linha 1-Azul / Linha 3-Vermelha','Azul'),
    ('Paraíso',-23.580128,-46.646925,'Linha 1-Azul / Linha 2-Verde','Azul'),
    ('São Bento',-23.546089,-46.635869,'Linha 1-Azul','Azul')
),
calc as (
  select t.talento_key, e.nome, e.linha, e.cor,
         round((6371 * 2 * asin(sqrt(
           power(sin(radians(e.lat - t.latitude)/2), 2) +
           cos(radians(t.latitude)) * cos(radians(e.lat)) *
           power(sin(radians(e.lng - t.longitude)/2), 2)
         )))::numeric, 3) as dist
  from public.nt_talentos t
  cross join lateral (
    select nome, lat, lng, linha, cor
    from est
    order by (
      power(sin(radians(est.lat - t.latitude)/2), 2) +
      cos(radians(t.latitude)) * cos(radians(est.lat)) *
      power(sin(radians(est.lng - t.longitude)/2), 2)
    ) asc
    limit 1
  ) e
  where t.metro_status = 'GEO_GENERICA'
    and t.latitude is not null and t.longitude is not null
)
update public.nt_talentos t
set estacao_mais_proxima = c.nome,
    linha_metro_mais_proxima = c.linha,
    cor_linha_metro = c.cor,
    distancia_metro_km = c.dist,
    metro_status = 'GEO_APROX'
from calc c
where c.talento_key = t.talento_key;

-- espelha na tabela pública (sem tocar updated_at p/ não reordenar)
update public.nt_talentos_publicos p
set estacao_mais_proxima = t.estacao_mais_proxima,
    linha_metro_mais_proxima = t.linha_metro_mais_proxima,
    cor_linha_metro = t.cor_linha_metro,
    distancia_metro_km = t.distancia_metro_km
from public.nt_talentos t
where t.talento_key = p.talento_key
  and t.metro_status = 'GEO_APROX';

-- atualiza materialized view + cache de cidades
select public.nt_refresh_base_pub_mv();
notify pgrst, 'reload schema';

-- conferência
select
  (select count(*) from public.nt_talentos where metro_status='GEO_APROX') as reaproximados,
  (select count(*) from public.nt_talentos_publicos where ativo and estacao_mais_proxima is not null) as com_metro_agora;
