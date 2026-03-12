--
-- PostgreSQL database dump
--

\restrict USj7N5gqjcQwtdjKwq1s4jz0Aiuo1B9ytsqNOBLpwhOuXCXjB6Eda6Wxir6h4LP

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA topology;


ALTER SCHEMA topology OWNER TO postgres;

--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: pgrouting; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgrouting WITH SCHEMA public;


--
-- Name: EXTENSION pgrouting; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgrouting IS 'pgRouting Extension';


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: grid_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.grid_lines (
    geometry public.geometry(LineString,3857),
    osm_id bigint,
    type text,
    voltage integer,
    operator text,
    name text,
    substation text,
    circuits text,
    usage text,
    db_id integer NOT NULL
);


ALTER TABLE public.grid_lines OWNER TO postgres;

--
-- Name: grid_lines_db_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.grid_lines_db_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.grid_lines_db_id_seq OWNER TO postgres;

--
-- Name: grid_lines_db_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.grid_lines_db_id_seq OWNED BY public.grid_lines.db_id;


--
-- Name: grid_points; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.grid_points (
    geometry public.geometry(Point,3857),
    osm_id bigint,
    type text,
    voltage integer,
    operator text,
    name text,
    substation text,
    circuits text,
    usage text,
    db_id integer NOT NULL
);


ALTER TABLE public.grid_points OWNER TO postgres;

--
-- Name: grid_points_db_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.grid_points_db_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.grid_points_db_id_seq OWNER TO postgres;

--
-- Name: grid_points_db_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.grid_points_db_id_seq OWNED BY public.grid_points.db_id;


--
-- Name: grid_polygons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.grid_polygons (
    geometry public.geometry(Polygon,3857),
    osm_id text,
    type text,
    voltage integer,
    operator text,
    name text,
    substation text,
    circuits text,
    usage text,
    db_id integer NOT NULL
);


ALTER TABLE public.grid_polygons OWNER TO postgres;

--
-- Name: grid_polygons_db_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.grid_polygons_db_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.grid_polygons_db_id_seq OWNER TO postgres;

--
-- Name: grid_polygons_db_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.grid_polygons_db_id_seq OWNED BY public.grid_polygons.db_id;


--
-- Name: gridkit_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gridkit_links (
    original_id integer,
    type text,
    voltage integer,
    voltage_src text,
    geom public.geometry(LineString,3857),
    id integer NOT NULL,
    source integer,
    target integer,
    is_synthetic boolean DEFAULT false,
    start_geom public.geometry(Point,3857),
    end_geom public.geometry(Point,3857)
);


ALTER TABLE public.gridkit_links OWNER TO postgres;

--
-- Name: gridkit_links_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gridkit_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gridkit_links_id_seq OWNER TO postgres;

--
-- Name: gridkit_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gridkit_links_id_seq OWNED BY public.gridkit_links.id;


--
-- Name: gridkit_nodes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gridkit_nodes (
    original_id integer,
    type text,
    name text,
    voltage integer,
    voltage_src text,
    geom public.geometry(Point,3857)
);


ALTER TABLE public.gridkit_nodes OWNER TO postgres;

--
-- Name: gridkit_polygons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gridkit_polygons (
    original_id integer,
    type text,
    name text,
    voltage integer,
    voltage_src text,
    geom public.geometry(Polygon,3857)
);


ALTER TABLE public.gridkit_polygons OWNER TO postgres;

--
-- Name: gridkit_towers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gridkit_towers (
    original_id integer,
    type text,
    name text,
    voltage integer,
    voltage_src text,
    geom public.geometry(Point,3857)
);


ALTER TABLE public.gridkit_towers OWNER TO postgres;

--
-- Name: gridkit_vertices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gridkit_vertices (
    the_geom public.geometry(Point,3857),
    id integer NOT NULL
);


ALTER TABLE public.gridkit_vertices OWNER TO postgres;

--
-- Name: gridkit_vertices_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gridkit_vertices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gridkit_vertices_id_seq OWNER TO postgres;

--
-- Name: gridkit_vertices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gridkit_vertices_id_seq OWNED BY public.gridkit_vertices.id;


--
-- Name: grid_lines db_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grid_lines ALTER COLUMN db_id SET DEFAULT nextval('public.grid_lines_db_id_seq'::regclass);


--
-- Name: grid_points db_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grid_points ALTER COLUMN db_id SET DEFAULT nextval('public.grid_points_db_id_seq'::regclass);


--
-- Name: grid_polygons db_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grid_polygons ALTER COLUMN db_id SET DEFAULT nextval('public.grid_polygons_db_id_seq'::regclass);


--
-- Name: gridkit_links id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gridkit_links ALTER COLUMN id SET DEFAULT nextval('public.gridkit_links_id_seq'::regclass);


--
-- Name: gridkit_vertices id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gridkit_vertices ALTER COLUMN id SET DEFAULT nextval('public.gridkit_vertices_id_seq'::regclass);


--
-- Name: grid_lines grid_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grid_lines
    ADD CONSTRAINT grid_lines_pkey PRIMARY KEY (db_id);


--
-- Name: grid_points grid_points_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grid_points
    ADD CONSTRAINT grid_points_pkey PRIMARY KEY (db_id);


--
-- Name: grid_polygons grid_polygons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grid_polygons
    ADD CONSTRAINT grid_polygons_pkey PRIMARY KEY (db_id);


--
-- Name: gridkit_links gridkit_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gridkit_links
    ADD CONSTRAINT gridkit_links_pkey PRIMARY KEY (id);


--
-- Name: gridkit_vertices gridkit_vertices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gridkit_vertices
    ADD CONSTRAINT gridkit_vertices_pkey PRIMARY KEY (id);


--
-- Name: idx_end_geom; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_end_geom ON public.gridkit_links USING gist (end_geom);


--
-- Name: idx_grid_lines_geom; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_grid_lines_geom ON public.grid_lines USING gist (geometry);


--
-- Name: idx_grid_lines_geometry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_grid_lines_geometry ON public.grid_lines USING gist (geometry);


--
-- Name: idx_grid_lines_osmid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_grid_lines_osmid ON public.grid_lines USING btree (osm_id);


--
-- Name: idx_grid_points_geom; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_grid_points_geom ON public.grid_points USING gist (geometry);


--
-- Name: idx_grid_points_geometry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_grid_points_geometry ON public.grid_points USING gist (geometry);


--
-- Name: idx_grid_points_osmid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_grid_points_osmid ON public.grid_points USING btree (osm_id);


--
-- Name: idx_grid_polygons_geom; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_grid_polygons_geom ON public.grid_polygons USING gist (geometry);


--
-- Name: idx_grid_polygons_geometry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_grid_polygons_geometry ON public.grid_polygons USING gist (geometry);


--
-- Name: idx_grid_polygons_osmid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_grid_polygons_osmid ON public.grid_polygons USING btree (osm_id);


--
-- Name: idx_links_geom_final; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_links_geom_final ON public.gridkit_links USING gist (geom);


--
-- Name: idx_nodes_geom; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nodes_geom ON public.gridkit_nodes USING gist (geom);


--
-- Name: idx_poly_geom; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_poly_geom ON public.gridkit_polygons USING gist (geom);


--
-- Name: idx_start_geom; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_start_geom ON public.gridkit_links USING gist (start_geom);


--
-- Name: idx_towers_geom; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_towers_geom ON public.gridkit_towers USING gist (geom);


--
-- Name: idx_v_geom; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_v_geom ON public.gridkit_vertices USING gist (the_geom);


--
-- PostgreSQL database dump complete
--

\unrestrict USj7N5gqjcQwtdjKwq1s4jz0Aiuo1B9ytsqNOBLpwhOuXCXjB6Eda6Wxir6h4LP

