/**
 * Migration Script: Upload tilings data and images to Supabase
 * 
 * Usage:
 *   node scripts/migrate-tilings.js
 * 
 * Requirements:
 *   - Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 *   - Run the schema.sql first to create tables and storage bucket
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const [key, ...valueParts] = trimmedLine.split('=');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join('=').trim();
                    process.env[key.trim()] = value;
                }
            }
        });
    }
}

loadEnv();

// Get environment variables
const PUBLIC_SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Configuration
if (!PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing environment variables');
    console.error('Please set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file');
    process.exit(1);
}

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});
// Paths
const STATIC_DIR = path.join(__dirname, '..', 'static', 'tilings');

// Tiling rules data (extracted from tilingRules.js)
// This includes ALL tilings, including the commented out ones
const tilingRules = [
    {
        title: "1-Uniform (Regular)",
        id: "1Ur",
        dual: true,
        rules: [
            {
                id: 1,
                name: "triangular",
                cr: "3^6",
                rulestring: "3/r60/r(h2)",
                dualname: "hexagonal",
                isRegular: true
            },
            {
                id: 2,
                name: "square",
                cr: "4^4",
                rulestring: "4-4-0,4/r90/r(v2)",
                dualname: "square",
                alternatives: ["4/m45/r(h1)", "4-4-0,4/r90/r(v2)"],
                isRegular: true
            },
            {
                id: 3,
                name: "hexagonal",
                cr: "6^3",
                rulestring: "6/r60/r(h1)",
                dualname: "triangular",
                isRegular: true
            }
        ]
    },
    {
        title: "1-Uniform (Semiregular)",
        id: "1Usr",
        dual: true,
        rules: [
            {
                id: 1,
                name: "Snub trihexagonal",
                cr: "3^4.6",
                rulestring: "6-3-3/r60/r(h5)",
                dualname: "floret pentagonal",
                isSemiregular: true
            },
            {
                id: 2,
                name: "Elongated triangular",
                cr: "3^3.4^2",
                rulestring: "4-3/m90/r(h2)",
                dualname: "prismatic pentagonal",
                isSemiregular: true
            },
            {
                id: 3,
                name: "Snub square",
                cr: "3^2.4.3.4",
                rulestring: "4-3-3,0,0,0,4/r90/r(h2)",
                dualname: "cairo pentagonal",
                isSemiregular: true
            },
            {
                id: 4,
                name: "Rhombitrihexagonal",
                cr: "3.4.6.4",
                rulestring: "6-4-3/m30/r(c2)",
                dualname: "deltoidal trihexagonal",
                isSemiregular: true
            },
            {
                id: 5,
                name: "Trihexagonal",
                cr: "(3.6)^2",
                rulestring: "6-3-6/m30/r(v4)",
                dualname: "rhombille",
                isSemiregular: true
            },
            {
                id: 6,
                name: "Truncated hexagonal",
                cr: "3.12^2",
                rulestring: "12-3/m30/r(h3)",
                dualname: "triakis triangular",
                isSemiregular: true
            },
            {
                id: 7,
                name: "Truncated trihexagonal",
                cr: "4.6.12",
                rulestring: "12-6,4/m30/r(c2)",
                dualname: "kisrhombille",
                isSemiregular: true
            },
            {
                id: 8,
                name: "Truncated square",
                cr: "4.8^2",
                rulestring: "8-4/m90/r(h4)",
                dualname: "tetrakis square",
                isSemiregular: true,
                golRules: {
                    standard: [],
                    dual: [
                        { rule: "B48/S234", description: "" },
                        { rule: "B1/S1/G50", description: "" }
                    ]
                }
            }
        ]
    },
    {
        title: "2-Uniform",
        id: "2U",
        dual: true,
        rules: [
            { id: 1, cr: "3^6;3^2.4.3.4", rulestring: "3-0,4-0,3/m30/r(c3)" },
            { id: 2, name: "Truncated hexagonal (dissected a)", cr: "3.4.6.4;3^2.4.3.4", rulestring: "6-4-3,3/m30/r(h1)" },
            { id: 3, name: "Truncated hexagonal (dissected b)", cr: "3.4.6.4;3^3.4^2", rulestring: "6-4-3-3/m30/r(h5)" },
            { id: 4, cr: "3.4.6.4;3.4^2.6", rulestring: "6-4-3,4-6/m30/r(c4)" },
            { id: 5, rulestring: "6-3/r120/m(h1)" },
            { id: 6, name: "Diminished rhombitrihexagonal", cr: "4.6.12;3.4.6.4", rulestring: "12-4,6-3/m30/r(c3)" },
            { id: 7, cr: "3^6;3^2.4.12", rulestring: "12-3,4-3/m30/r(c3)" },
            { id: 8, cr: "3.12^2;3.4.3.12", rulestring: "12-0,3,3-0,0,4/r90/r(h1)" },
            { id: 9, name: "hexagonal (2/3 dissected)", cr: "[3^6;3^4.6]_1", rulestring: "6-3,3-3/m30/r(h1)" },
            { id: 10, cr: "[3^6;3^4.6]_2", rulestring: "6-3-3,3-0,3/r60/r(h8)" },
            { id: 11, cr: "3^2.6^2;3^4.6", rulestring: "6-3/m90/r(h1)" },
            { id: 12, cr: "3.6.3.6;3^2.6^2", rulestring: "6-3,6/m90/r(h3)" },
            { id: 13, cr: "[3.4^2.6;3.6.3.6]_2", rulestring: "6-3,4-6-3,4-6,4/m90/r(c6)" },
            { id: 14, cr: "[3.4^2.6;3.6.3.6]_1", rulestring: "6-3,4/m90/r(h4)" },
            { id: 15, cr: "[3^3.4^2;3^2.4.3.4]_1", rulestring: "4-3,3-4,3/r90/m(h3)" },
            { id: 16, cr: "[3^3.4^2;3^2.4.3.4]_2", rulestring: "4-3^3-4,3/r(c2)/r(h13)/r(h45)" },
            { id: 17, cr: "[4^4;3^3.4^2]_1", rulestring: "4-3/m(h4)/m(h3)/r(h2)" },
            { id: 18, cr: "[4^4;3^3.4^2]_2", rulestring: "4-4-3-3/m90/r(h3)" },
            { id: 19, cr: "[3^6;3^3.4^2]_1", rulestring: "4-3,4-3,3/m90/r(h3)" },
            { id: 20, cr: "[3^6;3^3.4^2]_2", rulestring: "4-3-3-3/m90/r(h7)/r(h5)" }
        ]
    },
    {
        title: "3-Uniform (2 Vertex Types)",
        id: "3U2",
        dual: true,
        rules: [
            { id: 1, cr: "(3.4.6.4)^2;3.4^2.6", rulestring: "6-4-3,4-6,3/m30/r(c2)" },
            { id: 2, cr: "[(3^6)^2;3^4.6]_1", rulestring: "6-3-3/m30/r(v3)" },
            { id: 3, cr: "[(3^6)^2;3^4.6]_2", rulestring: "6-3-3-0,3-0,0,3/m30/r(v2)" },
            { id: 4, cr: "[(3^6)^2;3^4.6]_3", rulestring: "6-3-3-0,3,3-0,3-0,3/r60/r(h7)" },
            { id: 5, cr: "3^6;(3^4.6)^2", rulestring: "3-0,3,3-0,6/m90/r(h6)" },
            { id: 6, cr: "3^6;(3^2.4.3.4)^2", rulestring: "3-0,4-0,3,3/m30/m(h2)" },
            { id: 7, cr: "(3.4^2.6)^2;3.6.3.6", rulestring: "4-6,4-4,3,3/m90/r(h4)" },
            { id: 8, cr: "[3.4^2.6;(3.6.3.6)^2]_1", rulestring: "4-6,4-0,3,3/m180/r(v1)/r(h25)" },
            { id: 9, cr: "[3.4^2.6;(3.6.3.6)^2]_2", rulestring: "4-6,4-0,3,3/m90/r(v1)" },
            { id: 10, cr: "3^2.6^2;(3.6.3.6)^2", rulestring: "6-3,0,3^4/r(h4)/r(v15)/r(v30)" },
            { id: 11, cr: "(3^4.6)^2;3.6.3.6", rulestring: "6-3,3-0,3/r180/r(v1)/r(h12)" },
            { id: 12, cr: "[3^3.4^2;(4^4)^2]_1", rulestring: "4-4-4-3/m90/r(h4)" },
            { id: 13, cr: "[3^3.4^2;(4^4)^2]_2", rulestring: "4-4-3/r(h6)/m(h5)/r(h3)" },
            { id: 14, cr: "[(3^3.4^2)^2;4^4]_1", rulestring: "4-4-3-3-4/m90/r(h10)/r(c3)" },
            { id: 15, cr: "[(3^3.4^2)^2;4^4]_2", rulestring: "4-3,4-3,3-4/m90/r(h3)" },
            { id: 16, cr: "(3^3.4^2)^2;3^2.4.3.4", rulestring: "4-4,3,4-3^3-3,4-3-4/r180/r(h17)/r(h18)" },
            { id: 17, cr: "3^3.4^2;(3^2.4.3.4)^2", rulestring: "4-3,3-0,4,3/r180/r(h2)/r(h18)" },
            { id: 18, cr: "[3^6;(3^3.4^2)^2]_1", rulestring: "4-3,0,3-3-3/r(h5)/r(h19)/m(h18)" },
            { id: 19, cr: "[3^6;(3^3.4^2)^2]_2", rulestring: "4-3,0,3-3/r(h3)/r(h15)/m(h14)" },
            { id: 20, cr: "[(3^6)^2;3^3.4^2]_1", rulestring: "4-3-3-3-3-3/m90/r(h3)" },
            { id: 21, cr: "[(3^6)^2;3^3.4^2]_2", rulestring: "4-3-3-3-3/m90/r(h2)/m(h22)" }
        ]
    },
    {
        title: "3-Uniform (3 Vertex Types)",
        id: "3U3",
        dual: true,
        rules: [
            { id: 22, rulestring: "12-6,4-3,3,4/m30/r(c5)" },
            { id: 23, rulestring: "3-0,4-0,3,6-0,4/r60/r(c2)" },
            { id: 24, rulestring: "12-3,4,6-3/m60/m(c5)" },
            { id: 25, rulestring: "6-4-3,12,3-3/m30/r(h2)" },
            { id: 26, rulestring: "6-4-3,3-12-0,0,0,3/m30/r(c2)" },
            { id: 27, rulestring: "6-4-3,3-12/r60/r(h10)" },
            { id: 28, rulestring: "12-4,3-6,3-0,0,4/m30/r(h11)" },
            { id: 29, rulestring: "12-3,4-3-3-3/m30/m(h9)" },
            { id: 30, rulestring: "12-3,4-3,3/m30/r(v1)" },
            { id: 31, rulestring: "6-3-3-0,4-0,3-0,0,3/m30/r(h10)" },
            { id: 32, rulestring: "3-0,4-0,3,4-0,6/m30/r(c5)" },
            { id: 33, rulestring: "6-4-3,4-3,3/m30/r(c5)" },
            { id: 34, rulestring: "6-4-3,3-4,3,3-3/r60/r(v5)" },
            { id: 35, rulestring: "3-0,4-0,3-0,3/m30/r(h6)" },
            { id: 36, rulestring: "12-4-3,3/m90/r(h6)" },
            { id: 37, rulestring: "6-4,3-3,0,4-6/m90/r(v5)" },
            { id: 38, rulestring: "6-4,3-3,3,4-0,0,6,3/m90/r(h17)/m(h1)" },
            { id: 39, rulestring: "4-3-3-0,4/r90/r(h3)" },
            { id: 40, rulestring: "4-4-3,4-6/m180/r(c3)/r(h29)" },
            { id: 41, rulestring: "4-4,4-3,4-6/m90/r(c5)/r(v1)" },
            { id: 42, rulestring: "6-3,4-0,4,4-0,0,4/m90/r(h9)" },
            { id: 43, rulestring: "6-4,3,3-4/m(h4)/r180/r(v15)" },
            { id: 44, rulestring: "4-6-3,0,3,4,0,0,3/m90/r(h4)" },
            { id: 45, rulestring: "4-6,4,3-0,3,3,0,6/m(h2)/m" },
            { id: 46, rulestring: "4-6,4-0,3,3/r(h2)/m90/r(c9)" },
            { id: 47, rulestring: "4-6,4-0,3,3-0,0,3,3/m90/m(h13)/r(c1)" },
            { id: 48, rulestring: "6-6-0,3^3/r60/r(h2)" },
            { id: 49, rulestring: "6-6,6,3-0,3,3/m180/r(h8)/r(h49)" },
            { id: 50, rulestring: "6-3-3/m180/r(h3)/r(h15)" },
            { id: 51, rulestring: "3-0,6/m60/r(c2)" },
            { id: 52, rulestring: "6-3-3,3-0,3,3-0,0,3/r(h7)/r(h29)/r(h29)" },
            { id: 53, rulestring: "3-0,3,6-0,3/m180/r(h6)/r(c6)" },
            { id: 54, rulestring: "6-3-3/m90/r(h2)" },
            { id: 55, rulestring: "3-0,3,3-0,3,6,3/m90/r(v1)/r(v15)" },
            { id: 56, rulestring: "3-0,3-0,6-0,0,3/r60/r(c1)" },
            { id: 57, rulestring: "3-0,3-0,6/r60/r(v4)" },
            { id: 58, rulestring: "4-4-3-3/m90/r(h7)/r(v1)" },
            { id: 59, rulestring: "4-4-3-3-3/m90/r(h9)/r(h3)" },
            { id: 60, rulestring: "4-4-3-3-3/m(h9)/r(h1)/r(v1)" },
            { id: 61, rulestring: "4-4-3-3-3/m(h9)/r(h1)/r(h3)" }
        ]
    },
    {
        title: "4-Uniform",
        id: "4U",
        dual: true,
        rules: [
            { id: 1, rulestring: "3-0,6-0,0,6,6-0,0,6^3/r60/r(c1)" },
            { id: 2, rulestring: "6-6-0,6,3-0,0,3,3/r60/r(c1)" },
            { id: 6, rulestring: "6-6-0,3,4-0,0,4-0,0,3/m30/r(c5)" },
            { id: 22, rulestring: "6-3-6-0,3/m30/m(h5)" },
            { id: 25, rulestring: "12-4,6-4,3,4-6,4/m30/r(c7)" },
            { id: 26, rulestring: "12-4,6-4,3,6-0,3,0,3/m30/m(h3)" },
            { id: 27, rulestring: "12-4,6-4,3-3/m30/m(h7)" },
            { id: 108, cr: "[3.4.3.12;3.4.6.4;(3^2.4.3.4)^2]", rulestring: "12-3,3-4-3,6-0,4-0,3/m30/r(c7)" },
            { id: 118, rulestring: "3'-6-6,3,3-0,3,3,6-0,0,3^3-0,0,0,3/m60/r(c7)[120]" },
            { id: 119, rulestring: "6-3-6-3,3-0,3,3/r60/r(h13)" },
            { id: 132, rulestring: "4-3-3-0,4-12,3/r90/r(h12)" }
        ]
    },
    {
        title: "5-Uniform",
        id: "5U",
        dual: true,
        rules: [
            { id: 235, rulestring: "6-3,6-3,3-0,3-0,3-0,3-0,0,0,0,3,3-0,0,0,0,0,6/r120/r(h5)" },
            { id: 246, rulestring: "3-0,3-0,6-0,0,3-0,0,3-0,0,0,3/r60/r(h2)" },
            { id: 297, rulestring: "6-3-3,3-0,3,3-0,3^3-0,0,4^3-0,0,3/r60/r(c8)" }
        ]
    },
    {
        title: "6-Uniform",
        id: "6U",
        dual: true,
        rules: [
            { id: 6, rulestring: "6-6-0,6,6-0,3^4/m30/r(v3)" },
            { id: 86, rulestring: "12-4,6-3,4,12-3,3/m30/r(v2)" },
            { id: 108, rulestring: "12-3,12-0,3,3-0,4,0,0,3/m30/r(c3)" },
            { id: 316, rulestring: "6-3-6-4,3-3,0,4-3/m30/r(h11)" },
            { id: 372, rulestring: "6-3-6-4,3-3,0,4-0,3,6-0,0,0,3/m30/m(h1)" },
            { id: 379, rulestring: "3-0,4-0,3,4-0,6,4-0,6,3-0,3,0,3/m30/r(h17)" },
            { id: 585, rulestring: "6-3-3,3-0,3,6-0,3^3-0,0,3,6/r60/r(h3)" },
            { id: 611, rulestring: "12-3,4-3,3-4,3-0,3-0,3-0,3/m30/r(v8)" }
        ]
    },
    {
        title: "Concave 1-Uniform",
        id: "c1U",
        dual: true,
        rules: [
            { rulestring: "6(a)-3/r60/r(h4)", isConcave: true },
            { rulestring: "4(a)-4/r90/r(h4)", isConcave: true },
            { rulestring: "6-3(a)/r60/r(h2)", isConcave: true },
            { rulestring: "3(a)-3-3(a)-0,0,3/r120/t(c2)", isConcave: true }
        ]
    },
    {
        title: "Concave 2-Uniform",
        id: "c2U",
        dual: true,
        rules: [
            { rulestring: "{3|30}-3,4-6/r120/r(c3)", isConcave: true },
            { rulestring: "{4|18}-5,5,5,5-0,5,{4|18}-0,{4|18}/r90/r(c4)", isConcave: true },
            { rulestring: "{4|30}-3,3-0,0,4/r90/r(h2)", isConcave: true },
            { rulestring: "{4|30}-6-0,4/r90/r(c1)", isConcave: true },
            { rulestring: "{4|45}-8/r90/r(v5)", isConcave: true },
            { rulestring: "{4|60}-0,3,4-0,4/r90/r(c1)", isConcave: true },
            { rulestring: "{4|120}-3,3-4,0,{4|120}/r90/r(c1)", isConcave: true },
            { rulestring: "{6|30}-4/r60/r(c2)", isConcave: true },
            { rulestring: "{6.2}-3,3/r60/r(h3)", isConcave: true },
            { rulestring: "{6.2}-3,3-0,3/r60/r(h2)", isConcave: true },
            { rulestring: "{6.2}-6/r60/r(v1)", isConcave: true },
            { rulestring: "{6.2}-6-3/r60/r(c2)", isConcave: true },
            { rulestring: "{6|80}-9-0,{6|80},9/r60/r(c1)", isConcave: true },
            { rulestring: "{8|15}-3,3-3,4-0,3/r90/m(h1)", isConcave: true },
            { rulestring: "{8|15}-3,3-8,4/r90/r(c4)", isConcave: true },
            { rulestring: "9-{3|20},3-9/r120/t(c1)", isConcave: true },
            { rulestring: "12-0,{4|60}/m45/m(h1)", isConcave: true },
            { rulestring: "12-{3|30}-12/r60/r(v5)", isConcave: true },
            { rulestring: "{12.5}-3,3-0,3/m30/m(h1)", isConcave: true },
            { rulestring: "{12.5}-3,3-4,6/m30/r(c2)", isConcave: true },
            { rulestring: "{12|30}-0,12,{3|40}-0,{3|40}/m30/r(c3)", isConcave: true }
        ]
    },
    {
        title: "Concave 3-Uniform",
        id: "c3U",
        dual: true,
        rules: [
            { rulestring: "{3|30}-3,4-0,0,0,6/r120/r(v8)", isConcave: true },
            { rulestring: "3-7(150;150;90;150;120;150;90)/t(v7)/r(h2)/r(h8)", isConcave: true },
            { rulestring: "{6|30}-0,4,{6|90}/r120/r(c1)", isConcave: true },
            { rulestring: "{6|30}-4-0,{3|90}/r60/r(v5)", isConcave: true },
            { rulestring: "{6|48}-5-3{3|96}-0,5/r60/r(h6)", isConcave: true },
            { rulestring: "{6.2}-3,3-3,6/r60/r(h5)", isConcave: true },
            { rulestring: "{6.2}-6-3,0,3/r60/r(v2)", isConcave: true },
            { rulestring: "{6|75}-8-3{3|15}/r60/r(c2)", isConcave: true },
            { rulestring: "{6|90}-4,3-0,{3|30}/r60/r(h1)", isConcave: true },
            { rulestring: "{8|15}-0,3,0,{4|60}-0,3/r90/m(h7)", isConcave: true },
            { rulestring: "{8|15}-3,3-{4|45}/r90/r(v9)", isConcave: true },
            { rulestring: "{8.3}-4,4/m45/r(c1)", isConcave: true },
            { rulestring: "{12.2}-0,3,4-0,0,0,3/r60/r(v2)", isConcave: true },
            { rulestring: "{12.5}-3,3-3,12/r60/r(h2)", isConcave: true }
        ]
    },
    {
        title: "Concave 4-Uniform",
        id: "c4U",
        dual: true,
        rules: [
            { rulestring: "{12.3}-4,4-0,{3|90},0,{6|30}/r60/r(c4)", isConcave: true },
            { rulestring: "{6.2}-7(120;150;90;150;150;90;150)-0,0,3/r60/r(v2)", isConcave: true },
            { rulestring: "6-3-7(150;120;150;90;150;150;90)-3/r60/r(v5)", isConcave: true },
            { rulestring: "{6.2}-6-3/r60/m(h1)", isConcave: true },
            { rulestring: "{6.2}-6-3,0,3-0,0,0,3/r60/r(h4)", isConcave: true },
            { rulestring: "{8.3}-4-{8|90}/r90/r(v2)", isConcave: true },
            { rulestring: "{8.3}-4,4-8-8,4/r90/r(h11)", isConcave: true },
            { rulestring: "{8|75}-3^3-0,0,{4|30}/r90/r(h1)", isConcave: true },
            { rulestring: "{12.2}-12,4,3/m45/r(v10)", isConcave: true },
            { rulestring: "{12.5}-3^3-{4|60},12/r90/r(c2)", isConcave: true }
        ]
    },
    {
        title: "Concave 5-Uniform",
        id: "c5U",
        dual: true,
        rules: [
            { rulestring: "3-{3|30}-0,4-{4|30}/r90/r(h11)", isConcave: true },
            { rulestring: "{4|30}-{3|30},0,0,0,0,0,0,5(90;90;150;60;150)/r90/r(h17)", isConcave: true },
            { rulestring: "6-6-0,0,3-0,0,3,0,6-0,0,0,{6.2}-3,3/r60/r(h2)", isConcave: true },
            { rulestring: "6-{3|90},4,{3|90}-0,0,0,0,0,3/r/r(h2)/r(v25)", isConcave: true },
            { rulestring: "{6|75}-3,3-{8|15}-3^6-{3|15}/r60/r(c6)", isConcave: true },
            { rulestring: "{6.2}-6-{3|60}-0,3,3-0,6/r60/r(v2)", isConcave: true },
            { rulestring: "{12.2}-4,4,3,3-0,3-4,6,4,6/r60/r(c8)", isConcave: true },
            { rulestring: "{12.3}-3^3-3,4,3-3/r60/r(v7)", isConcave: true },
            { rulestring: "{12.3}-6-0,{4|120}/m30/m(h1)", isConcave: true }
        ]
    },
    {
        title: "Concave 6-Uniform",
        id: "c6U",
        dual: true,
        rules: [
            { rulestring: "{3|90}-6,0,0,0,0,4-0,0,0,0,0,0,0,0,0,3/r(h8)/r(h8)/r(h1)", isConcave: true },
            { rulestring: "{4|30}-6-0,{3|150}-0,4,0-3{3|150}-0,4/r90/r(h15)", isConcave: true },
            { rulestring: "{6|90}-3-0,3{3|150}-3,4-0,6/r60/r(v7)", isConcave: true },
            { rulestring: "{12.3}-6,3-0,3,{4|30}/m30/m(h1)", isConcave: true }
        ]
    },
    {
        title: "Concave 7-Uniform",
        id: "c7U",
        dual: true,
        rules: [
            { rulestring: "{3|90}-4-3,4,6-3,6,{6|90},3/r120/r(h1)", isConcave: true },
            { rulestring: "6-{3|90},4-3-12-0,0,0,0,3,3/m90/m(h7)/r(c2)", isConcave: true },
            { rulestring: "{6|30}-4-{3|90},3-4,6,3/r60/r(v2)", isConcave: true },
            { rulestring: "{6|75}-3,3-{8|15}-3^6-{3|15}-8,{6|75}/r60/r(c2)", isConcave: true },
            { rulestring: "12-3,{3|150},3-3,0,0,3/m90/m(h14)/r(v5)", isConcave: true }
        ]
    },
    {
        title: "Concave k-Uniform",
        id: "ckU",
        dual: true,
        rules: [
            { rulestring: "12-3,3-4,4-6,6-{4|30},{4|30}-3^6-3^5-3,3,0,0,3,3/m30/m(h2)", isConcave: true },
            { rulestring: "12-3,3-4,4-6,6-{4|30},{4|30}-3^6-3^5-3,3,0,0,6/m30/m(h2)", isConcave: true },
            { rulestring: "12-3,3-4-6,6-{4|30}-3,3-3,0,3,3-0,0,{6|60}/m30/r(h2)", isConcave: true },
            { rulestring: "12-3^3-4^3-3^4-0,12,4,3-0,0,0,0,0,0,4,{3|30}-0,0,0,0,0,0,{3|30},3/r60/r(c4)", isConcave: true },
            { rulestring: "12-4,4-3,0,{3|30}-6,0,3-0,3,3,0,{4|30}-0,0,0,0,4,3-0,0,0,0,0,3/m30/r(h4)", isConcave: true },
            { rulestring: "{12|60}-4^3-3,3-12,4,6/m45/r(c7)", isConcave: true },
            { rulestring: "{12|60}-4^3-3^4-12,4,3/m45/r(v14)", isConcave: true },
            { rulestring: "{12|60}-4^3-3^4-12,4,3-0,0,0,4,{3|30}-0,0,0,{3|30},3/r60/r(c2)", isConcave: true },
            { rulestring: "{12|60}-4^4-3^6-0,0,0,0,0,{4|120}/r90/m(h9)", isConcave: true },
            { rulestring: "{12.2}-12,4,3-0,0,0,4,{3|30}-0,0,0,{3|30},3/r60/r(c1)", isConcave: true },
            { rulestring: "{12.3}-3^4-0,12,4,3-0,0,0,0,0,0,4,{3|30}-0,0,0,0,0,0,{3|30},3/r60/r(c2)", isConcave: true },
            { rulestring: "{12.3}-6,6-{4|30},{4|30}-3^4-3,0,0,3-0,0,3,6/m30/m(h1)", isConcave: true }
        ]
    }
];

/**
 * Convert rulestring to filename format
 */
function ruleStringToFilename(rulestring) {
    return rulestring
        .replaceAll('/', '_')
        .replaceAll('*', '_')
        .replaceAll('{', '')
        .replaceAll('}', '')
        .replaceAll('|', '(')
        .replace(/\((\d+)\)(?=[^)]|$)/g, '($1)'); // Handle special notation
}

/**
 * Find image file for a tiling
 */
function findImageFile(groupId, rulestring, isDual = false) {
    const groupDir = path.join(STATIC_DIR, groupId);
    
    if (!fs.existsSync(groupDir)) {
        console.warn(`  Warning: Group directory not found: ${groupDir}`);
        return null;
    }
    
    // Generate the expected filename
    let filename = rulestring
        .replaceAll('/', '_')
        .replaceAll('*', '_');
    
    if (isDual) {
        filename += '_';
    }
    filename += '.webp';
    
    const filePath = path.join(groupDir, filename);
    
    if (fs.existsSync(filePath)) {
        return filePath;
    }
    
    // Try alternative filename formats for concave tilings
    const altFilename = rulestring
        .replaceAll('/', '_')
        .replaceAll('*', '_')
        .replaceAll('{', '')
        .replaceAll('}', '')
        .replaceAll('|', '(')
        .replace(/3\{(\d+)\|(\d+)\}/g, '3($2)')  // Handle 3{n|m} notation
        + (isDual ? '_' : '') + '.webp';
    
    const altFilePath = path.join(groupDir, altFilename);
    
    if (fs.existsSync(altFilePath)) {
        return altFilePath;
    }
    
    // List files in directory to find a match
    const files = fs.readdirSync(groupDir);
    const baseRulestring = rulestring.split('/')[0];
    
    for (const file of files) {
        if (file.includes(baseRulestring.replaceAll('/', '_').substring(0, 10))) {
            const expectedDual = isDual ? file.endsWith('_.webp') : !file.endsWith('_.webp');
            if (expectedDual) {
                return path.join(groupDir, file);
            }
        }
    }
    
    return null;
}

/**
 * Upload image to Supabase Storage
 */
async function uploadImage(filePath, groupId, rulestring, isDual = false) {
    if (!filePath || !fs.existsSync(filePath)) {
        return null;
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = `${groupId}/${rulestring.replaceAll('/', '_').replaceAll('*', '_')}${isDual ? '_dual' : ''}.webp`;
    
    const { data, error } = await supabase.storage
        .from('tilings')
        .upload(fileName, fileBuffer, {
            contentType: 'image/webp',
            upsert: true
        });
    
    if (error) {
        console.error(`  Error uploading ${fileName}:`, error.message);
        return null;
    }
    
    const { data: { publicUrl } } = supabase.storage
        .from('tilings')
        .getPublicUrl(fileName);
    
    return publicUrl;
}

/**
 * Determine tiling classification based on rulestring and metadata
 */
function classifyTiling(rule, groupId) {
    const rulestring = rule.rulestring;
    
    // Check for star polygons (notation like {n.m} or {n|m})
    const isStar = /\{(\d+)\.(\d+)\}|\{(\d+)\|(\d+)\}/.test(rulestring);
    
    // Check for concave (group starts with 'c')
    const isConcave = groupId.startsWith('c') || rule.isConcave;
    
    // Regular tilings: 1Ur group
    const isRegular = rule.isRegular || groupId === '1Ur';
    
    // Semiregular tilings: 1Usr group
    const isSemiregular = rule.isSemiregular || groupId === '1Usr';
    
    // Edge-to-edge: most tilings are edge-to-edge by definition
    const isEdgeToEdge = true;
    
    // Isotoxal: some specific tilings
    const isIsotoxal = false; // Would need specific identification
    
    return {
        isRegular,
        isSemiregular,
        isStar,
        isIsotoxal,
        isEdgeToEdge,
        isConcave
    };
}

/**
 * Main migration function
 */
async function migrate() {
    console.log('Starting TilingLife migration to Supabase...\n');
    
    let totalTilings = 0;
    let uploadedImages = 0;
    let failedImages = 0;
    
    for (const group of tilingRules) {
        console.log(`\nProcessing group: ${group.title} (${group.id})`);
        console.log(`  Rules count: ${group.rules.length}`);
        
        for (const rule of group.rules) {
            totalTilings++;
            
            // Get classification
            const classification = classifyTiling(rule, group.id);
            
            // Find and upload images
            const imagePath = findImageFile(group.id, rule.rulestring, false);
            const dualImagePath = group.dual ? findImageFile(group.id, rule.rulestring, true) : null;
            
            let imageUrl = null;
            let dualImageUrl = null;
            
            if (imagePath) {
                console.log(`  Uploading: ${rule.rulestring}`);
                imageUrl = await uploadImage(imagePath, group.id, rule.rulestring, false);
                if (imageUrl) {
                    uploadedImages++;
                } else {
                    failedImages++;
                }
            } else {
                console.log(`  No image found for: ${rule.rulestring}`);
                failedImages++;
            }
            
            if (dualImagePath) {
                dualImageUrl = await uploadImage(dualImagePath, group.id, rule.rulestring, true);
                if (dualImageUrl) {
                    uploadedImages++;
                }
            }
            
            // Insert tiling into database
            const { error } = await supabase
                .from('tilings')
                .upsert({
                    original_id: rule.id || null,
                    name: rule.name || null,
                    rulestring: rule.rulestring,
                    cr_notation: rule.cr || null,
                    group_id: group.id,
                    dual_name: rule.dualname || null,
                    is_regular: classification.isRegular,
                    is_semiregular: classification.isSemiregular,
                    is_star: classification.isStar,
                    is_concave: classification.isConcave,
                    alternatives: rule.alternatives || [],
                    image_url: imageUrl,
                    dual_image_url: dualImageUrl
                }, {
                    onConflict: 'rulestring'
                });
            
            if (error) {
                console.error(`  Error inserting ${rule.rulestring}:`, error.message);
            }
        }
    }
    
    console.log('\n========================================');
    console.log('Migration Summary:');
    console.log(`  Total tilings: ${totalTilings}`);
    console.log(`  Images uploaded: ${uploadedImages}`);
    console.log(`  Images failed/not found: ${failedImages}`);
    console.log('========================================\n');
}

// Run migration
migrate().catch(console.error);
