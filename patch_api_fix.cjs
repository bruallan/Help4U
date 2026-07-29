const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf-8');

code = code.replace(
  `     res.json({ success: true, pOpt, E });
   } catch (e: any) {
     res.status(500).json({ error: e.message });
   }
});
   } catch (e: any) {
     res.status(500).json({ error: e.message });
   }
});`,
  `     res.json({ success: true, pOpt, E });
   } catch (e: any) {
     res.status(500).json({ error: e.message });
   }
});`
);

fs.writeFileSync('api/index.ts', code);
