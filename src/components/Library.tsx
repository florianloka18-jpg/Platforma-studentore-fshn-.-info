import React, { useState, useEffect } from 'react';
import { Book, Download, Upload, FileText, Search, Plus, X, Globe, ExternalLink, BookOpen, Library as LibraryIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';

interface BookType {
  id: number;
  title: string;
  author: string;
  file_path?: string;
  external_link?: string;
  uploader_id: number | string;
  uploader_name: string;
  uploader_surname?: string;
  uploader_role?: string;
  created_at: string;
}

const BookCover = ({ title, author, color }: { title: string, author: string, color: string }) => {
  return (
    <div className={`w-full aspect-[3/4] ${color} rounded-r-xl rounded-l-sm shadow-xl relative overflow-hidden group-hover:scale-105 transition-transform duration-300 flex flex-col p-4 border-l-4 border-black/10`}>
      {/* Spine Effect */}
      <div className="absolute left-0 top-0 bottom-0 w-2 bg-black/10"></div>
      <div className="absolute left-2 top-0 bottom-0 w-px bg-white/10"></div>
      
      {/* Book Texture */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/pinstriped-suit.png")' }}></div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full justify-between py-2">
        <div>
          <div className="w-8 h-1 bg-white/30 rounded-full mb-4"></div>
          <h3 className="text-white font-black text-sm leading-tight line-clamp-3 uppercase tracking-tighter drop-shadow-sm">
            {title}
          </h3>
        </div>
        
        <div>
          <div className="w-full h-px bg-white/20 mb-2"></div>
          <p className="text-white/80 text-[10px] font-bold uppercase truncate tracking-widest">
            {author || 'Autori Panjohur'}
          </p>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute right-2 bottom-2 opacity-20">
        <BookOpen size={24} className="text-white" />
      </div>
    </div>
  );
};

const Library: React.FC<{ overrideClassId?: string }> = ({ overrideClassId }) => {
  const { user, apiFetch } = useAuth();
  const [books, setBooks] = useState<BookType[]>([]);
  
  const getBookColor = (title: string) => {
    const colors = [
      'bg-blue-600', 'bg-indigo-600', 'bg-emerald-600', 
      'bg-rose-600', 'bg-amber-600', 'bg-slate-700',
      'bg-violet-600', 'bg-cyan-600', 'bg-teal-600'
    ];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingBook, setViewingBook] = useState<BookType | null>(null);
  const [userClasses, setUserClasses] = useState<any[]>([]);
  const [selectedFilterClassId, setSelectedFilterClassId] = useState<string>('ALL');
  const [currentClassName, setCurrentClassName] = useState<string>('');
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    external_link: '',
    selectedClassId: '',
    file: null as File | null
  });

  useEffect(() => {
    fetchBooks();
  }, [overrideClassId, selectedFilterClassId]);

  useEffect(() => {
    // Always fetch classes for filtering/uploading if we're in the top-level library
    if (!overrideClassId) {
      fetchUserClasses();
    }
    
    if (showUpload && overrideClassId) {
      fetchCurrentClassName();
    }
  }, [showUpload, overrideClassId, user?.role]);

  const fetchCurrentClassName = async () => {
    if (!overrideClassId) return;
    try {
      // First check if it's already in our userClasses list
      const existing = userClasses.find(c => c.id.toString() === overrideClassId.toString());
      if (existing) {
        setCurrentClassName(existing.name);
        return;
      }
      
      const data = await apiFetch(`/api/classes/${overrideClassId}`);
      setCurrentClassName(data.name);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUserClasses = async () => {
    try {
      const data = await apiFetch('/api/classes/my');
      setUserClasses(data);
      if (!formData.selectedClassId) {
        setFormData(prev => ({ ...prev, selectedClassId: 'GLOBAL' }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [deletingId, setDeletingId] = useState<any>(null);

  const fetchBooks = async () => {
    try {
      setLoading(true);
      let classParam = overrideClassId || (selectedFilterClassId !== 'ALL' ? selectedFilterClassId : '');
      const url = classParam 
        ? `/api/library/books?classId=${classParam}` 
        : '/api/library/books';
      const data = await apiFetch(url);
      setBooks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.file && !formData.external_link) return;

    const classToUpload = overrideClassId || formData.selectedClassId;
    if (!classToUpload && user?.role === 'TEACHER') {
      alert("Ju lutem zgjidhni një klasë për të ngarkuar librin.");
      return;
    }

    setUploadLoading(true);
    const data = new FormData();
    data.append('title', formData.title);
    data.append('author', formData.author);
    if (formData.file) data.append('file', formData.file);
    if (formData.external_link) data.append('external_link', formData.external_link);
    if (classToUpload) data.append('classId', classToUpload);

    try {
      await apiFetch('/api/library/upload', {
        method: 'POST',
        body: data
      });
      setShowUpload(false);
      setFormData({ title: '', author: '', external_link: '', selectedClassId: '', file: null });
      fetchBooks();
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Gabim gjatë ngarkimit.');
    } finally {
      setUploadLoading(false);
    }
  };

  const filteredBooks = books.filter(book => 
    book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.author.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canUpload = user?.role === 'TEACHER' || user?.is_class_admin;

  const handleDelete = async (bookId: any) => {
    if (!window.confirm("A jeni të sigurt që dëshironi të fshini këtë libër?")) return;
    try {
      setDeletingId(bookId);
      await apiFetch(`/api/library/books/${bookId}`, { method: 'DELETE' });
      fetchBooks();
    } catch (e: any) {
      console.error("Delete Error:", e);
      alert(e.message || "Gabim gjatë fshirjes");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Libraria Digjitale</h2>
            <p className="text-slate-500">Akseso librat dhe materialet studimore</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {!overrideClassId && userClasses.length > 1 && (
              <div className="hidden lg:flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 pl-2">Klasa:</span>
                <select 
                  value={selectedFilterClassId}
                  onChange={(e) => setSelectedFilterClassId(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-700 outline-none px-2 pr-4 border-l border-slate-100 min-w-[200px]"
                >
                  <option value="ALL">Gjithë Materialet</option>
                  {userClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.group_name ? `(${c.group_name})` : ''}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Kërko libra..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
              />
            </div>
            {canUpload && (
              <button 
                onClick={() => setShowUpload(true)}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
              >
                <Plus size={20} />
                <span className="hidden sm:inline">Shto Libër</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 w-fit rounded-2xl">
          <div className="px-6 py-2 rounded-xl text-sm font-bold bg-white text-blue-600 shadow-sm">
            Librat e Klasës
          </div>
          <a 
            href="https://welib.st/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 text-slate-500 hover:text-slate-900 hover:bg-white/50"
          >
            <Globe size={16} />
            WeLib Personal
            <ExternalLink size={14} className="opacity-50" />
          </a>
        </div>
      </div>

      {/* Main Library View */}
      {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Book size={40} className="text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Asnjë libër nuk u gjet</h3>
              <p className="text-slate-500">Nuk ka materiale të disponueshme për momentin.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredBooks.map((book) => (
                <motion.div 
                  key={book.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col h-full"
                >
                  <div className="mb-4">
                    <BookCover 
                      title={book.title} 
                      author={book.author} 
                      color={getBookColor(book.title)} 
                    />
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-end">
                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="text-[10px] text-slate-400">
                      <p className="font-bold uppercase tracking-wider">Ngarkuar nga</p>
                      <p className="font-bold text-slate-600">{book.uploader_name} {book.uploader_surname || ''}</p>
                      <p className={`inline-block px-1 rounded-[4px] mt-0.5 ${book.uploader_role === 'TEACHER' ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-50 text-slate-500'}`}>
                        {book.uploader_role || 'STUDENT'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {(user?.id.toString() === book.uploader_id.toString() || user?.role === 'TEACHER' || user?.is_class_admin) && (
                        <button 
                          onClick={() => handleDelete(book.id)}
                          disabled={deletingId === book.id}
                          className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                          title="Fshi"
                        >
                          {deletingId === book.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <X size={14} />
                          )}
                        </button>
                      )}
                      {book.external_link && (
                        <button 
                          onClick={() => setViewingBook(book)}
                          className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all flex items-center gap-1 text-[10px] font-bold"
                          title="Lexo Online"
                        >
                          <Globe size={14} />
                          Lexo
                        </button>
                      )}
                      {book.file_path && (
                        <a 
                          href={book.file_path} 
                          download 
                          className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                          title="Shkarko"
                        >
                          <Download size={18} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                </motion.div>
              ))}
            </div>
          )}

      <AnimatePresence>
        {viewingBook && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600 text-white rounded-xl">
                      <Book size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 leading-tight">{viewingBook.title}</h3>
                      <p className="text-xs text-slate-500 font-medium">{viewingBook.author}</p>
                    </div>
                 </div>
                 <button 
                  onClick={() => setViewingBook(null)}
                  className="p-2 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all border border-slate-100 shadow-sm"
                 >
                   <X size={20} />
                 </button>
              </div>
              <div className="flex-1 bg-slate-200/50 relative">
                 <iframe 
                   src={viewingBook.external_link} 
                   className="w-full h-full border-0"
                   title={viewingBook.title}
                 />
              </div>
              <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-500 font-medium">Ngarkuar nga {viewingBook.uploader_name}</p>
                <a 
                  href={viewingBook.external_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
                >
                  Hap në Tab të ri <ExternalLink size={12} />
                </a>
              </div>
            </motion.div>
          </div>
        )}

        {showUpload && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative"
            >
              <button 
                onClick={() => setShowUpload(false)}
                className="absolute right-6 top-6 text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
              
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Shto Libër të Ri</h3>
              
              <form onSubmit={handleUpload} className="space-y-4">
                {(user?.role === 'TEACHER' || overrideClassId) && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Klasa e Destinacionit</label>
                    {overrideClassId ? (
                      <div className="w-full p-3 rounded-xl border border-blue-100 bg-blue-50 text-blue-700 font-bold flex items-center gap-2">
                        <LibraryIcon size={16} />
                        {currentClassName || 'Duke ngarkuar...'}
                      </div>
                    ) : (
                      <select
                        required
                        value={formData.selectedClassId}
                        onChange={(e) => setFormData({...formData, selectedClassId: e.target.value})}
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                      >
                        <option value="GLOBAL">Publike (Gjithë Universitetin)</option>
                        {userClasses.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.group_name ? `(Gr. ${c.group_name})` : ''} - {c.year || ''} {c.department || c.program || ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Titulli</label>
                  <input 
                    type="text" 
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Titulli i librit..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Autori</label>
                  <input 
                    type="text" 
                    value={formData.author}
                    onChange={(e) => setFormData({...formData, author: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Emri i autorit..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Link i Jashtëm (Shto nëse nuk ke file)</label>
                  <div className="relative">
                    <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="url" 
                      value={formData.external_link}
                      onChange={(e) => setFormData({...formData, external_link: e.target.value})}
                      className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="https://example.com/book.pdf"
                    />
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-100"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-slate-400 font-bold">Ose</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">File (PDF, DOC, etj.)</label>
                  <input 
                    type="file" 
                    onChange={(e) => setFormData({...formData, file: e.target.files?.[0] || null})}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                
                <button 
                  disabled={uploadLoading}
                  className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 mt-4"
                >
                  {uploadLoading ? 'Duke u ngarkuar...' : 'Publiko Librin'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Library;
