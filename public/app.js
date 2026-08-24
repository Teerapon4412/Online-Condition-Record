"use strict";
const $=id=>document.getElementById(id);
const state={models:[],parts:[],template:[],history:[]};

async function api(path,options={}){
  const r=await fetch(`/api${path}`,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||`HTTP ${r.status}`);
  return data;
}
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
function fmt(v){if(!v)return"-";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat("th-TH",{dateStyle:"short",timeStyle:"short"}).format(d)}
function msg(t,e=false){$("message").textContent=t||"";$("message").className=`message ${t?(e?"error":"ok"):""}`}
function today(){const d=new Date(),x=new Date(d-d.getTimezoneOffset()*60000);$("recordDate").value=x.toISOString().slice(0,10)}

async function loadModels(){
  const {models=[]}=await api("/models");state.models=models;
  const opts=models.map(m=>`<option value="${m.id}">${esc(m.modelCode)} - ${esc(m.modelName)}</option>`).join("");
  $("modelSelect").innerHTML=`<option value="">-- เลือก Model --</option>${opts}`;
  $("historyModel").innerHTML=`<option value="">ทุก Model</option>${opts}`;
}
async function loadParts(modelId,target="main"){
  const s=target==="history"?$("historyPart"):$("partSelect");
  if(!modelId){
    s.innerHTML=`<option value="">${target==="history"?"ทุก Part":"เลือก Model ก่อน"}</option>`;
    if(target==="main"){s.disabled=true;emptyTemplate("เลือก Model และ Part เพื่อโหลด Condition")}
    return [];
  }
  const {parts=[]}=await api(`/models/${modelId}/parts`);
  if(target==="main")state.parts=parts;
  s.innerHTML=`<option value="">${target==="history"?"ทุก Part":"-- เลือก Part --"}</option>`+
    parts.map(p=>`<option value="${p.id}">${esc(p.partCode)} - ${esc(p.partName)}</option>`).join("");
  s.disabled=false;return parts;
}
async function loadTemplate(partId){
  if(!partId)return emptyTemplate("เลือก Part เพื่อโหลด Condition");
  const {part,items=[]}=await api(`/parts/${partId}/template`);
  state.template=items;$("machineCode").value=part?.machineCode||"";
  $("templateInfo").textContent=`${part.modelCode} / ${part.partCode} - ${part.partName}`;
  $("itemCount").textContent=`${items.length} รายการ`;$("saveBtn").disabled=!items.length;renderTemplate();
}
function emptyTemplate(text){
  state.template=[];$("itemCount").textContent="0 รายการ";$("templateInfo").textContent=text;
  $("conditionRows").innerHTML=`<tr><td colspan="6" class="empty">${esc(text)}</td></tr>`;
  $("saveBtn").disabled=true;summary();
}
function renderTemplate(){
  if(!state.template.length)return emptyTemplate("Part นี้ยังไม่มี Condition Template");
  $("conditionRows").innerHTML=state.template.map(i=>`<tr data-row="${i.itemNo}">
    <td>${i.itemNo}</td><td><strong>${esc(i.conditionGroup)}</strong></td><td>${esc(i.topic)}</td>
    <td>${esc(i.standardValue||"-")}</td>
    <td><input class="actual-input" data-item="${i.itemNo}" type="text" inputmode="decimal" placeholder="${i.isRequired?"กรอกค่าที่ตรวจพบ":"N/A / ไม่บังคับ"}" autocomplete="off"></td>
    <td><div id="status-${i.itemNo}" class="status-badge pending">รอค่า</div><div id="detail-${i.itemNo}" class="validation-detail"></div></td>
  </tr>`).join("");
  document.querySelectorAll(".actual-input").forEach(x=>{
    x.addEventListener("input",()=>{validate(Number(x.dataset.item),x.value);summary()});
    x.addEventListener("blur",()=>{const r=validate(Number(x.dataset.item),x.value);if(r.status==="NG")msg(`แจ้งเตือน: Condition ลำดับ ${x.dataset.item} อยู่นอกค่ามาตรฐาน`,true)});
  });summary();
}
function nums(v){const m=String(v??"").replaceAll(",","").match(/-?\d+(?:\.\d+)?/g);return m?m.map(Number).filter(Number.isFinite):[]}
function rule(std){
  const s=String(std||"").trim();
  if(!s||s==="-")return{type:"none"};
  if(/ไม่ได้ใช้งาน|not\s*used|n\/a/i.test(s))return{type:"na"};
  if(/ใช้\s*=\s*1\s*\/\s*ไม่ใช้\s*=\s*0/i.test(s))return{type:"enum",allowed:[0,1]};
  let m=s.match(/(-?\d+(?:\.\d+)?)\s*[^±]*±\s*(-?\d+(?:\.\d+)?)/);
  if(m){const c=+m[1],t=Math.abs(+m[2]);return{type:"range",min:c-t,max:c+t}}
  m=s.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
  if(m)return{type:"range",min:Math.min(+m[1],+m[2]),max:Math.max(+m[1],+m[2])};
  m=s.match(/(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/);
  if(m)return{type:"pair",a:+m[1],b:+m[2]};
  const n=nums(s);if(n.length===1)return{type:"exact",value:n[0]};
  return{type:"text",value:s.toLowerCase()};
}
function evaluate(actual,std,required=true){
  const a=String(actual??"").trim(),r=rule(std);
  if(!a)return{status:required?"PENDING":"NA",message:required?"ยังไม่ได้กรอกค่า":"ไม่บังคับกรอก"};
  if(r.type==="na")return{status:"NA",message:"รายการนี้ไม่ได้ใช้งาน"};
  if(r.type==="none")return{status:"OK",message:"บันทึกค่าแล้ว"};
  const n=nums(a);
  if(r.type==="enum"){const ok=n.length===1&&r.allowed.includes(n[0]);return{status:ok?"OK":"NG",message:ok?"อยู่ในค่าที่กำหนด":"รับค่า 1 = ใช้ หรือ 0 = ไม่ใช้"}}
  if(r.type==="range"){const ok=n.length===1&&n[0]>=r.min&&n[0]<=r.max;return{status:ok?"OK":"NG",message:ok?`อยู่ในช่วง ${r.min} ถึง ${r.max}`:`นอกมาตรฐาน: ต้องอยู่ระหว่าง ${r.min} ถึง ${r.max}`}}
  if(r.type==="pair"){const ok=n.length===2&&Math.abs(n[0]-r.a)<.001&&Math.abs(n[1]-r.b)<.001;return{status:ok?"OK":"NG",message:ok?"ตรงตามค่ามาตรฐาน":`นอกมาตรฐาน: ต้องเป็น ${r.a} / ${r.b}`}}
  if(r.type==="exact"){const ok=n.length===1&&Math.abs(n[0]-r.value)<.001;return{status:ok?"OK":"NG",message:ok?"ตรงตามค่ามาตรฐาน":`นอกมาตรฐาน: ต้องเป็น ${r.value}`}}
  const ok=a.toLowerCase()===r.value;return{status:ok?"OK":"NG",message:ok?"ตรงตามค่ามาตรฐาน":`ต้องตรงกับ ${std}`};
}
function validate(no,value){
  const i=state.template.find(x=>+x.itemNo===+no);if(!i)return{status:"PENDING",message:""};
  const r=evaluate(value,i.standardValue,i.isRequired),row=document.querySelector(`[data-row="${no}"]`),b=$(`status-${no}`),d=$(`detail-${no}`);
  row?.classList.remove("condition-row-ok","condition-row-ng");if(r.status==="OK")row?.classList.add("condition-row-ok");if(r.status==="NG")row?.classList.add("condition-row-ng");
  if(b){b.className="status-badge "+(r.status==="OK"?"ok":r.status==="NG"?"ng":r.status==="NA"?"na":"pending");b.textContent=r.status==="PENDING"?"รอค่า":r.status==="NA"?"N/A":r.status}
  if(d){d.textContent=r.message||"";d.className=`validation-detail ${r.status==="NG"?"ng":""}`}
  return r;
}
function summary(){
  const el=$("validationSummary");if(!el)return;if(!state.template.length){el.innerHTML='<div class="validation-chip neutral">ยังไม่ได้ตรวจสอบ</div>';return}
  const rs=state.template.map(i=>evaluate(document.querySelector(`.actual-input[data-item="${i.itemNo}"]`)?.value||"",i.standardValue,i.isRequired));
  const c=s=>rs.filter(x=>x.status===s).length;
  el.innerHTML=`<div class="validation-chip ok">OK ${c("OK")}</div><div class="validation-chip ng">NG ${c("NG")}</div><div class="validation-chip pending">รอกรอก ${c("PENDING")}</div><div class="validation-chip neutral">N/A ${c("NA")}</div>`;
}
function collect(){return state.template.map(i=>{const actualValue=document.querySelector(`.actual-input[data-item="${i.itemNo}"]`)?.value.trim()||"",v=evaluate(actualValue,i.standardValue,i.isRequired);return{itemNo:i.itemNo,actualValue,validationStatus:v.status,validationMessage:v.message}})}
function clearValues(){document.querySelectorAll(".actual-input").forEach(x=>x.value="");state.template.forEach(i=>validate(i.itemNo,""));summary()}

async function save(){
  const modelId=+$("modelSelect").value,partId=+$("partSelect").value;if(!modelId||!partId)return msg("กรุณาเลือก Model และ Part",true);
  const items=collect(),missing=state.template.filter(i=>i.isRequired&&!items.find(x=>+x.itemNo===+i.itemNo)?.actualValue);
  if(missing.length)return msg(`กรุณากรอก Condition ให้ครบ: ${missing.map(x=>x.itemNo).join(", ")}`,true);
  const ng=state.template.map(i=>({i,r:validate(i.itemNo,items.find(x=>+x.itemNo===+i.itemNo)?.actualValue||"")})).filter(x=>x.r.status==="NG");
  if(ng.length){const list=ng.map(x=>x.i.itemNo).join(", ");msg(`แจ้งเตือน: พบ Condition นอกมาตรฐาน ${ng.length} รายการ: ${list}`,true);if(!confirm(`พบ Condition นอกค่ามาตรฐาน ${ng.length} รายการ\nลำดับ: ${list}\n\nต้องการบันทึกข้อมูล NG นี้ไว้ใน History หรือไม่?`))return}
  $("saveBtn").disabled=true;msg("กำลังบันทึก...");
  try{const data=await api("/records",{method:"POST",body:JSON.stringify({modelId,partId,recordDate:$("recordDate").value||null,machineCode:$("machineCode").value.trim(),shift:$("shift").value,recorderName:$("recorderName").value.trim(),items})});msg(`บันทึกเรียบร้อย: ${data.record.recordNo}`);clearValues();await loadHistory()}
  catch(e){msg(`บันทึกไม่สำเร็จ: ${e.message}`,true)}finally{$("saveBtn").disabled=!state.template.length}
}
async function loadHistory(){
  const p=new URLSearchParams();[["modelId","historyModel"],["partId","historyPart"],["dateFrom","dateFrom"],["dateTo","dateTo"]].forEach(([k,id])=>{$(id).value&&p.set(k,$(id).value)});$("historySearch").value.trim()&&p.set("q",$("historySearch").value.trim());
  $("historyRows").innerHTML='<tr><td colspan="9" class="empty">กำลังโหลด History...</td></tr>';
  try{const {records=[]}=await api(`/records?${p}`);state.history=records;renderHistory()}catch(e){$("historyRows").innerHTML=`<tr><td colspan="9" class="empty">โหลด History ไม่สำเร็จ: ${esc(e.message)}</td></tr>`}
}
function renderHistory(){
  if(!state.history.length){$("historyRows").innerHTML='<tr><td colspan="9" class="empty">ยังไม่มี Condition Record</td></tr>';return}
  $("historyRows").innerHTML=state.history.map(r=>`<tr><td>${fmt(r.recordedAt||r.recordDate)}</td><td>${esc(r.recordNo||"-")}</td><td>${esc(r.modelCode||"-")}</td><td>${esc(r.partCode||"-")}</td><td>${esc(r.machineCode||"-")}</td><td>${esc(r.shift||"-")}</td><td>${esc(r.recorderName||r.recorderCode||"-")}</td><td>${r.itemCount||0}</td><td><button class="btn btn-view" data-record="${r.id}">View</button></td></tr>`).join("");
  document.querySelectorAll("[data-record]").forEach(b=>b.onclick=()=>detail(b.dataset.record));
}
function savedStatus(i){const f=evaluate(i.actualValue||"",i.standardValue||"",true),s=i.validationStatus||f.status,m=i.validationMessage||f.message,c=s==="OK"?"ok":s==="NG"?"ng":s==="NA"?"na":"pending";return`<div class="status-badge ${c}">${esc(s==="PENDING"?"รอค่า":s)}</div><div class="validation-detail ${s==="NG"?"ng":""}">${esc(m||"")}</div>`}
async function detail(id){
  try{const {record:r,items=[]}=await api(`/records/${id}`);$("detailTitle").textContent=`${r.recordNo} | ${r.modelCode} / ${r.partCode}`;
    $("detailMeta").innerHTML=[["Model",`${r.modelCode} - ${r.modelName}`],["Part",`${r.partCode} - ${r.partName}`],["Machine",r.machineCode||"-"],["Shift",r.shift||"-"],["วันที่",fmt(r.recordedAt||r.recordDate)],["ผู้บันทึก",r.recorderName||r.recorderCode||"-"],["Record No.",r.recordNo||"-"]].map(([a,b])=>`<div class="meta-box"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join("");
    $("detailRows").innerHTML=items.map(i=>`<tr><td>${i.itemNo}</td><td>${esc(i.conditionGroup||"-")}</td><td>${esc(i.topic||"-")}</td><td>${esc(i.standardValue||"-")}</td><td><strong>${esc(i.actualValue||"-")}</strong></td><td>${savedStatus(i)}</td></tr>`).join("");$("detailDialog").showModal()
  }catch(e){alert(`โหลดรายละเอียดไม่สำเร็จ: ${e.message}`)}
}

$("modelSelect").onchange=async()=>{msg("");await loadParts($("modelSelect").value)};
$("partSelect").onchange=()=>loadTemplate($("partSelect").value).catch(e=>emptyTemplate(`โหลด Condition ไม่สำเร็จ: ${e.message}`));
$("historyModel").onchange=async()=>{await loadParts($("historyModel").value,"history");await loadHistory()};
["historyPart","dateFrom","dateTo"].forEach(id=>$(id).onchange=loadHistory);
let timer;$("historySearch").oninput=()=>{clearTimeout(timer);timer=setTimeout(loadHistory,350)};
$("saveBtn").onclick=save;$("clearBtn").onclick=clearValues;$("reloadHistoryBtn").onclick=loadHistory;$("closeDetailBtn").onclick=()=>$("detailDialog").close();

(async()=>{today();try{await loadModels();await loadHistory()}catch(e){msg(`เริ่มระบบไม่สำเร็จ: ${e.message}`,true)}})();
