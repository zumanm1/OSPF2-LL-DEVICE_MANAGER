
import React, { useState, useEffect } from 'react';
import { COUNTRIES } from '../constants';
import { BulkUpdateData } from '../App';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (updateData: BulkUpdateData) => void;
  selectedCount: number;
}

const BulkEditModal: React.FC<BulkEditModalProps> = ({ isOpen, onClose, onSubmit, selectedCount }) => {
  const [country, setCountry] = useState('Unchanged');
  const [tagsToAdd, setTagsToAdd] = useState<string[]>([]);
  const [tagsToRemove, setTagsToRemove] = useState<string[]>([]);
  const [currentTagAdd, setCurrentTagAdd] = useState('');
  const [currentTagRemove, setCurrentTagRemove] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Reset form on open
      setCountry('Unchanged');
      setTagsToAdd([]);
      setTagsToRemove([]);
      setCurrentTagAdd('');
      setCurrentTagRemove('');
    }
  }, [isOpen]);

  const handleTagKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentTag: string,
    setCurrentTag: React.Dispatch<React.SetStateAction<string>>,
    setTags: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = currentTag.trim();
      if (newTag) {
        setTags(prev => [...new Set([...prev, newTag])]); // Add tag, ensuring uniqueness
      }
      setCurrentTag('');
    }
  };
  
  const removeTag = (
    tagToRemove: string,
    setTags: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit({
      country: country === 'Unchanged' ? undefined : country,
      tagsToAdd: tagsToAdd.length > 0 ? tagsToAdd : undefined,
      tagsToRemove: tagsToRemove.length > 0 ? tagsToRemove : undefined,
    });
  };

  if (!isOpen) return null;

  const TagInput: React.FC<{
    tags: string[];
    currentTag: string;
    setCurrentTag: (val: string) => void;
    setTags: (tags: string[]) => void;
    placeholder: string;
    id: string;
    colorClass: string;
  }> = ({ tags, currentTag, setCurrentTag, setTags, placeholder, id, colorClass }) => (
    <div className="flex flex-wrap items-center gap-2 p-2 form-input min-h-[44px]">
      {tags.map(tag => (
        <span key={tag} className={`flex items-center gap-1.5 ${colorClass} text-sm font-medium px-2.5 py-1 rounded-full`}>
          {tag}
          <button type="button" onClick={() => removeTag(tag, setTags)} className="text-current opacity-70 hover:opacity-100 focus:outline-none" aria-label={`Remove ${tag} tag`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </span>
      ))}
      <input
        type="text"
        id={id}
        value={currentTag}
        onChange={(e) => setCurrentTag(e.target.value)}
        onKeyDown={(e) => handleTagKeyDown(e, currentTag, setCurrentTag, setTags)}
        placeholder={placeholder}
        className="flex-grow bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none p-1"
      />
    </div>
  );

  return (
    <div 
      className="fixed inset-0 bg-black/60 dark:bg-black/80 flex justify-center items-center z-50 p-4 animate-fade-in"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Edit Devices</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Applying changes to {selectedCount} selected device(s).</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label htmlFor="country-bulk" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Change Country</label>
            <select 
              id="country-bulk" 
              value={country} 
              onChange={(e) => setCountry(e.target.value)} 
              className="w-full form-select"
            >
              <option value="Unchanged">[ No Change ]</option>
              {COUNTRIES.map(opt => <option key={opt.code3} value={opt.name}>{opt.name}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="tags-add" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Add Tags</label>
            <TagInput 
              id="tags-add"
              tags={tagsToAdd}
              setTags={setTagsToAdd}
              currentTag={currentTagAdd}
              setCurrentTag={setCurrentTagAdd}
              placeholder="Add tags..."
              colorClass="bg-green-100 text-green-800 dark:bg-green-600/30 dark:text-green-300"
            />
          </div>

          <div>
            <label htmlFor="tags-remove" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Remove Tags</label>
            <TagInput
              id="tags-remove"
              tags={tagsToRemove}
              setTags={setTagsToRemove}
              currentTag={currentTagRemove}
              setCurrentTag={setCurrentTagRemove}
              placeholder="Remove tags..."
              colorClass="bg-red-100 text-red-800 dark:bg-red-600/30 dark:text-red-300"
            />
          </div>

          <div className="flex justify-end items-center gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-100 dark:bg-gray-600/50 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white transition-colors font-medium">Cancel</button>
            <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors font-semibold shadow-lg shadow-blue-500/20">Apply Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkEditModal;